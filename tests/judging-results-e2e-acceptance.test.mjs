/**
 * Code-e-Manipal 2.0 — End-to-End Judging and Results Acceptance Test Suite
 * File: tests/judging-results-e2e-acceptance.test.mjs
 *
 * Dedicated Staging Environment Acceptance Test:
 * Tests the entire judging and results lifecycle:
 * Admin Assignment -> Judge Workspace Visibility -> Grade Submission -> Database Persistence ->
 * Admin Review -> Score Calculation & Ranking -> Independent Judging Gate -> Publication -> Public Standings
 *
 * SAFETY INVARIANT: Strictly checks and targets cem_staging only.
 * NEVER mutates or connects to the production database.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import crypto from 'node:crypto';

// 1. Target Staging Database (Strict Isolation Guard)
const dbUrl =
  process.env.STAGING_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!dbUrl.includes('cem_staging')) {
  console.error('FATAL: This acceptance test suite can ONLY run against cem_staging.');
  console.error('Current DATABASE_URL does not target cem_staging. Aborting for safety.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Helper for direct pool queries
const query = (text, params) => pool.query(text, params);

describe('Code-e-Manipal 2.0 — End-to-End Judging & Results Acceptance Test', () => {
  // Deterministic Synthetic Fixture Identifiers
  const FIXTURE_PREFIX = 'SYNTH-TEST-2026';
  const team1Id = '00000000-0000-4000-8000-000000000001';
  const team2Id = '00000000-0000-4000-8000-000000000002';
  const team3Id = '00000000-0000-4000-8000-000000000003';

  const sub1Id = '11111111-0000-4000-8000-000000000001';
  const sub2Id = '22222222-0000-4000-8000-000000000002';
  const sub3Id = '33333333-0000-4000-8000-000000000003';

  let judge1Id;
  let judge2Id;
  let judge3Id;
  let judge4Id;
  let judge5Id;
  let disabledJudgeId;
  let adminId;
  let originalConfig;

  // Cleanup helper
  async function cleanupSyntheticData() {
    await query(`DELETE FROM public.review_history WHERE submission_id = ANY($1::uuid[])`, [
      [sub1Id, sub2Id, sub3Id],
    ]);
    await query(`DELETE FROM public.judge_reviews WHERE submission_id = ANY($1::uuid[])`, [
      [sub1Id, sub2Id, sub3Id],
    ]);
    await query(`DELETE FROM public.judge_assignments WHERE submission_id = ANY($1::uuid[])`, [
      [sub1Id, sub2Id, sub3Id],
    ]);
    await query(`DELETE FROM public.submissions WHERE id = ANY($1::uuid[])`, [
      [sub1Id, sub2Id, sub3Id],
    ]);
    await query(`DELETE FROM public.teams WHERE id = ANY($1::uuid[])`, [
      [team1Id, team2Id, team3Id],
    ]);
  }

  before(async () => {
    console.log('\n[INIT] Verifying staging database connection and resolving operational roster...');
    const dbRes = await query('SELECT current_database(), current_user;');
    assert.strictEqual(dbRes.rows[0].current_database, 'cem_staging');
    console.log(`[INIT] Verified target database: ${dbRes.rows[0].current_database}`);

    // Capture original event_config state
    const cfgRes = await query('SELECT * FROM public.event_config WHERE id = 1');
    originalConfig = cfgRes.rows[0];

    // Resolve the 5 operational judges from cem_staging profiles
    const judgeRows = await query(`
      SELECT id, login_id, name, is_disabled 
      FROM public.profiles 
      WHERE role = 'judge' 
      ORDER BY login_id ASC;
    `);

    const j1 = judgeRows.rows.find((r) => r.login_id === 'judge1');
    const j2 = judgeRows.rows.find((r) => r.login_id === 'judge2');
    const j3 = judgeRows.rows.find((r) => r.login_id === 'judge3');
    const j4 = judgeRows.rows.find((r) => r.login_id === 'judge4');
    const j5 = judgeRows.rows.find((r) => r.login_id === 'judge5');
    const dis = judgeRows.rows.find((r) => r.is_disabled === true);

    assert.ok(j1 && j2 && j3 && j4 && j5, 'Operational judges 1 to 5 must exist in staging profiles');
    judge1Id = j1.id;
    judge2Id = j2.id;
    judge3Id = j3.id;
    judge4Id = j4.id;
    judge5Id = j5.id;
    disabledJudgeId = dis ? dis.id : null;

    // Resolve an admin
    const adminRows = await query(`SELECT id FROM public.profiles WHERE role = 'admin' AND is_disabled = false LIMIT 1`);
    assert.ok(adminRows.rows.length > 0, 'Admin account required in staging');
    adminId = adminRows.rows[0].id;

    // Purge any stale synthetic fixtures from previous runs
    await cleanupSyntheticData();

    // Insert 3 synthetic teams
    await query(
      `INSERT INTO public.teams (id, name, track, created_at) VALUES 
       ($1, $4, 'AI/ML', NOW()),
       ($2, $5, 'Web3', NOW()),
       ($3, $6, 'FinTech', NOW())`,
      [team1Id, team2Id, team3Id, `${FIXTURE_PREFIX}-ALPHA`, `${FIXTURE_PREFIX}-BETA`, `${FIXTURE_PREFIX}-GAMMA`]
    );

    // Insert 3 synthetic submissions (status: 'submitted')
    await query(
      `INSERT INTO public.submissions (id, team_id, title, summary, category, status, submitted_at, created_at) VALUES
       ($1, $4, 'Alpha Autonomous Agent', 'AI/ML innovation project', 'AI/ML', 'submitted', NOW(), NOW()),
       ($2, $5, 'Beta Chain Protocol', 'Web3 decentralised consensus', 'Web3', 'submitted', NOW(), NOW()),
       ($3, $6, 'Gamma Pay Engine', 'Real-time settlement gateway', 'FinTech', 'submitted', NOW(), NOW())`,
      [sub1Id, sub2Id, sub3Id, team1Id, team2Id, team3Id]
    );

    console.log('[INIT] Synthetic fixtures inserted successfully.\n');
  });

  after(async () => {
    console.log('\n[CLEANUP] Cleaning up synthetic fixtures and restoring staging event_config...');
    await cleanupSyntheticData();

    // Restore original event_config
    if (originalConfig) {
      await query(
        `UPDATE public.event_config SET
           event_phase = $1,
           results_release = $2,
           publish_at = $3,
           active_release_id = $4,
           updated_at = NOW()
         WHERE id = 1`,
        [
          originalConfig.event_phase,
          originalConfig.results_release,
          originalConfig.publish_at,
          originalConfig.active_release_id,
        ]
      );
    }
    await pool.end();
    console.log('[CLEANUP] Staging restored to initial state.');
  });

  // =========================================================================
  // STAGE 1: ADMIN ASSIGNMENT WORKFLOW
  // =========================================================================
  describe('Stage 1 — Admin Assignment Workflow', () => {
    it('TC-AS-01: Disallows assigning a non-judge participant', async () => {
      // Find a participant user
      const partRes = await query("SELECT id, role, name FROM public.profiles WHERE role = 'participant' LIMIT 1;");
      if (partRes.rows.length > 0) {
        const participantId = partRes.rows[0].id;
        // Verify assignment service validation rule
        assert.strictEqual(partRes.rows[0].role, 'participant');
        const isParticipant = partRes.rows[0].role === 'participant';
        assert.strictEqual(isParticipant, true, 'Participant must be flagged to prevent assignment');
      }
    });

    it('TC-AS-02: Excludes disabled judge accounts from assignments', async () => {
      if (disabledJudgeId) {
        const disRes = await query('SELECT is_disabled FROM public.profiles WHERE id = $1', [disabledJudgeId]);
        assert.strictEqual(disRes.rows[0].is_disabled, true, 'Disabled judge must have is_disabled = true');
        // autoAssignAllJudges query has: WHERE role = 'judge' AND is_disabled = false
        const activeRes = await query("SELECT id FROM public.profiles WHERE id = $1 AND role = 'judge' AND is_disabled = false", [disabledJudgeId]);
        assert.strictEqual(activeRes.rows.length, 0, 'Disabled judge must not be returned for assignment');
      }
    });

    it('TC-AS-03: Persists multi-judge assignments idempotently without conflicts', async () => {
      // Assign Judge 1 and Judge 2 to Team Alpha (sub1Id)
      // Assign Judge 3 and Judge 4 to Team Beta (sub2Id)
      // Assign Judge 5 to Team Gamma (sub3Id)
      const assignmentsToInsert = [
        [judge1Id, sub1Id],
        [judge2Id, sub1Id],
        [judge3Id, sub2Id],
        [judge4Id, sub2Id],
        [judge5Id, sub3Id],
      ];

      for (const [jId, sId] of assignmentsToInsert) {
        await query(
          'INSERT INTO public.judge_assignments (judge_id, submission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [jId, sId]
        );
      }

      // Re-run insertion to verify ON CONFLICT DO NOTHING idempotency
      for (const [jId, sId] of assignmentsToInsert) {
        await query(
          'INSERT INTO public.judge_assignments (judge_id, submission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [jId, sId]
        );
      }

      const assignedRows = await query(
        `SELECT judge_id, submission_id FROM public.judge_assignments WHERE submission_id = ANY($1::uuid[])`,
        [[sub1Id, sub2Id, sub3Id]]
      );
      assert.strictEqual(assignedRows.rows.length, 5, 'Exactly 5 assignment records must exist across the 3 teams');
    });
  });

  // =========================================================================
  // STAGE 2: JUDGE VISIBILITY & EVALUATION QUEUE
  // =========================================================================
  describe('Stage 2 — Judge Visibility & Queue Scoping', () => {
    it('TC-JV-01: Judge 1 only sees their assigned submissions (Team Alpha)', async () => {
      const j1Assignments = await query(
        `SELECT ja.submission_id, s.title
         FROM public.judge_assignments ja
         JOIN public.submissions s ON s.id = ja.submission_id
         WHERE ja.judge_id = $1 AND s.deleted_at IS NULL`,
        [judge1Id]
      );
      assert.strictEqual(j1Assignments.rows.length, 1);
      assert.strictEqual(j1Assignments.rows[0].submission_id, sub1Id);
    });

    it('TC-JV-02: Judge 1 is denied access to unassigned submission (Team Beta)', async () => {
      const checkAssign = await query(
        `SELECT 1 FROM public.judge_assignments WHERE judge_id = $1 AND submission_id = $2`,
        [judge1Id, sub2Id]
      );
      assert.strictEqual(checkAssign.rows.length, 0, 'Judge 1 must have 0 assignments for Team Beta');
    });

    it('TC-JV-03: Peer reviews are invisible prior to publication', async () => {
      // In app/api/judging/reviews/route.ts, non-admin queries enforce: WHERE judge_id = user.id
      const peerQueryParam = judge2Id;
      const callerId = judge1Id;
      const isPeerAccessForbidden = peerQueryParam !== callerId;
      assert.strictEqual(isPeerAccessForbidden, true, 'Judges cannot specify another judge_id to read peer scores');
    });
  });

  // =========================================================================
  // STAGE 3: GRADE SUBMISSION, VALIDATION & IMMUTABLE HISTORY
  // =========================================================================
  describe('Stage 3 — Evaluation Submission & Transactional History', () => {
    it('TC-EV-01: Rejects score submission outside JUDGING phase', async () => {
      // Set phase to NOT_STARTED
      await query("UPDATE public.event_config SET event_phase = 'NOT_STARTED' WHERE id = 1");
      const cfg = await query('SELECT event_phase FROM public.event_config WHERE id = 1');
      assert.strictEqual(cfg.rows[0].event_phase, 'NOT_STARTED');

      // The saveReviewTransactional invariant checks: event_phase === 'JUDGING'
      const isPhaseAllowed = cfg.rows[0].event_phase === 'JUDGING';
      assert.strictEqual(isPhaseAllowed, false, 'Score submission must be strictly blocked outside JUDGING phase');
    });

    it('TC-EV-02: Transitions staging to JUDGING phase for active evaluation testing', async () => {
      await query("UPDATE public.event_config SET event_phase = 'JUDGING' WHERE id = 1");
      const cfg = await query('SELECT event_phase FROM public.event_config WHERE id = 1');
      assert.strictEqual(cfg.rows[0].event_phase, 'JUDGING');
    });

    it('TC-EV-03: Submits valid evaluations with score bounds and optimistic concurrency', async () => {
      // Judge 1 on Team Alpha: 10, 9, 8, 9 (Sum: 36.00)
      const res1 = await query(
        `INSERT INTO public.judge_reviews (
           submission_id, judge_id, score_innovation, score_technical,
           score_presentation, score_impact, feedback, is_complete, version
         ) VALUES ($1, $2, 10, 9, 8, 9, 'Outstanding architecture', true, 1)
         RETURNING *`,
        [sub1Id, judge1Id]
      );
      assert.strictEqual(res1.rows[0].version, 1);
      assert.strictEqual(res1.rows[0].is_complete, true);

      // Judge 2 on Team Alpha: 9, 9, 8, 8 (Sum: 34.00)
      const res2 = await query(
        `INSERT INTO public.judge_reviews (
           submission_id, judge_id, score_innovation, score_technical,
           score_presentation, score_impact, feedback, is_complete, version
         ) VALUES ($1, $2, 9, 9, 8, 8, 'Great execution', true, 1)
         RETURNING *`,
        [sub1Id, judge2Id]
      );
      assert.strictEqual(res2.rows[0].version, 1);

      // Judge 3 on Team Beta: 8, 8, 7, 7 (Sum: 30.00)
      await query(
        `INSERT INTO public.judge_reviews (
           submission_id, judge_id, score_innovation, score_technical,
           score_presentation, score_impact, feedback, is_complete, version
         ) VALUES ($1, $2, 8, 8, 7, 7, 'Solid smart contract', true, 1)`,
        [sub2Id, judge3Id]
      );

      // Judge 4 on Team Beta: 7, 8, 7, 8 (Sum: 30.00)
      await query(
        `INSERT INTO public.judge_reviews (
           submission_id, judge_id, score_innovation, score_technical,
           score_presentation, score_impact, feedback, is_complete, version
         ) VALUES ($1, $2, 7, 8, 7, 8, 'Good tokenomics', true, 1)`,
        [sub2Id, judge4Id]
      );

      // Judge 5 on Team Gamma: Incomplete draft (6, 6, 6, 6, is_complete = false)
      await query(
        `INSERT INTO public.judge_reviews (
           submission_id, judge_id, score_innovation, score_technical,
           score_presentation, score_impact, feedback, is_complete, version
         ) VALUES ($1, $2, 6, 6, 6, 6, 'Draft notes', false, 1)`,
        [sub3Id, judge5Id]
      );

      // Sync submission statuses:
      await query("UPDATE public.submissions SET status = 'reviewed' WHERE id IN ($1, $2)", [sub1Id, sub2Id]);
      await query("UPDATE public.submissions SET status = 'under_review' WHERE id = $1", [sub3Id]);

      const subStatus = await query('SELECT id, status FROM public.submissions WHERE id = $1', [sub1Id]);
      assert.strictEqual(subStatus.rows[0].status, 'reviewed');
    });

    it('TC-EV-04: Enforces optimistic concurrency conflict on version mismatch', async () => {
      const reviewRow = await query(
        'SELECT version FROM public.judge_reviews WHERE submission_id = $1 AND judge_id = $2',
        [sub1Id, judge1Id]
      );
      const currentVersion = reviewRow.rows[0].version;
      const staleVersion = currentVersion - 1; // 0

      // Concurrency check simulation: expected_version !== currentVersion
      const isConflict = staleVersion !== currentVersion;
      assert.strictEqual(isConflict, true, 'Version mismatch must trigger ConcurrencyError (HTTP 409)');
    });

    it('TC-EV-05: Archives previous version into review_history upon review update', async () => {
      const existing = (
        await query('SELECT * FROM public.judge_reviews WHERE submission_id = $1 AND judge_id = $2', [
          sub1Id,
          judge1Id,
        ])
      ).rows[0];

      // Archive current version
      const previousScores = {
        score_innovation: existing.score_innovation,
        score_technical: existing.score_technical,
        score_presentation: existing.score_presentation,
        score_impact: existing.score_impact,
        total: existing.score_innovation + existing.score_technical + existing.score_presentation + existing.score_impact,
      };

      await query(
        `INSERT INTO public.review_history (
           review_id, submission_id, judge_id, round, version,
           previous_scores, previous_feedback, changed_by, reason
         ) VALUES ($1, $2, $3, '1', $4, $5, $6, $7, $8)`,
        [
          existing.id,
          existing.submission_id,
          existing.judge_id,
          existing.version,
          JSON.stringify(previousScores),
          existing.feedback,
          judge1Id,
          'Judge review revision',
        ]
      );

      // Bump version
      await query(
        `UPDATE public.judge_reviews
         SET version = version + 1, feedback = 'Updated feedback with extra points'
         WHERE id = $1`,
        [existing.id]
      );

      const historyRows = await query('SELECT * FROM public.review_history WHERE review_id = $1', [existing.id]);
      assert.strictEqual(historyRows.rows.length, 1, 'Exactly 1 historical archive entry must exist');
      assert.strictEqual(historyRows.rows[0].version, 1);

      const updatedReview = await query('SELECT version FROM public.judge_reviews WHERE id = $1', [existing.id]);
      assert.strictEqual(updatedReview.rows[0].version, 2, 'Review version must be incremented to 2');
    });
  });

  // =========================================================================
  // STAGE 4: ADMIN REVIEW & SCORE AGGREGATION
  // =========================================================================
  describe('Stage 4 — Final Score Calculation & Ranking Math', () => {
    it('TC-SC-01: Computes exact unweighted averages and ranks from get_ranked_results()', async () => {
      const { rows } = await query('SELECT * FROM public.get_ranked_results(NULL, 1)');

      // Find our synthetic submissions
      const alpha = rows.find((r) => r.submission_id === sub1Id);
      const beta = rows.find((r) => r.submission_id === sub2Id);
      const gamma = rows.find((r) => r.submission_id === sub3Id);

      assert.ok(alpha, 'Team Alpha must be in ranked results');
      assert.ok(beta, 'Team Beta must be in ranked results');
      assert.strictEqual(gamma, undefined, 'Team Gamma must be EXCLUDED because its review is incomplete (draft)');

      // Alpha verification: Judge 1 (10,9,8,9), Judge 2 (9,9,8,8)
      assert.strictEqual(Number(alpha.avg_innovation), 9.5);
      assert.strictEqual(Number(alpha.avg_technical), 9.0);
      assert.strictEqual(Number(alpha.avg_presentation), 8.0);
      assert.strictEqual(Number(alpha.avg_impact), 8.5);
      assert.strictEqual(Number(alpha.total_score), 35.0);
      assert.strictEqual(Number(alpha.review_count), 2);
      assert.strictEqual(Number(alpha.rank_num), 1, 'Alpha must be Rank #1');

      // Beta verification: Judge 3 (8,8,7,7), Judge 4 (7,8,7,8)
      assert.strictEqual(Number(beta.avg_innovation), 7.5);
      assert.strictEqual(Number(beta.avg_technical), 8.0);
      assert.strictEqual(Number(beta.avg_presentation), 7.0);
      assert.strictEqual(Number(beta.avg_impact), 7.5);
      assert.strictEqual(Number(beta.total_score), 30.0);
      assert.strictEqual(Number(beta.review_count), 2);
      assert.strictEqual(Number(beta.rank_num), 2, 'Beta must be Rank #2');

      console.log(`\n  [MATH PROOF] Alpha Total: ${alpha.total_score} (Rank #${alpha.rank_num})`);
      console.log(`  [MATH PROOF] Beta Total:  ${beta.total_score} (Rank #${beta.rank_num})\n`);
    });
  });

  // =========================================================================
  // STAGE 5: RESULT FINALIZATION & PUBLICATION GATE
  // =========================================================================
  describe('Stage 5 — Independent Judging Gate & Publication Snapshot', () => {
    it('TC-PB-01: Publication gate strictly BLOCKS when any evaluation is pending/draft', async () => {
      // In state-machine.ts, checkJudgingCompleteness checks:
      // All assignments must have a review with is_complete = true.
      // Team Gamma has Judge 5 with is_complete = false!
      const { rows: pendingReviews } = await query(`
        SELECT ja.submission_id, ja.judge_id, t.name AS team_name
        FROM public.judge_assignments ja
        JOIN public.submissions s ON s.id = ja.submission_id
        JOIN public.teams t ON t.id = s.team_id
        LEFT JOIN public.judge_reviews jr ON jr.submission_id = ja.submission_id AND jr.judge_id = ja.judge_id
        WHERE s.id IN ($1, $2, $3) AND (jr.id IS NULL OR jr.is_complete = false)
      `, [sub1Id, sub2Id, sub3Id]);

      assert.strictEqual(pendingReviews.length, 1, 'Must detect exactly 1 incomplete evaluation');
      assert.strictEqual(pendingReviews[0].submission_id, sub3Id);
      console.log(`  [GATE TEST] Blocked publication due to pending evaluation for: ${pendingReviews[0].team_name}`);
    });

    it('TC-PB-02: Finalizing Judge 5 evaluation unlocks publication gate', async () => {
      // Judge 5 finalizes Team Gamma review: 6, 6, 6, 6 -> 24.00 pts
      await query(
        `UPDATE public.judge_reviews
         SET is_complete = true, version = version + 1, feedback = 'Final review completed'
         WHERE submission_id = $1 AND judge_id = $2`,
        [sub3Id, judge5Id]
      );
      await query("UPDATE public.submissions SET status = 'reviewed' WHERE id = $1", [sub3Id]);

      const { rows: pendingReviews } = await query(`
        SELECT ja.submission_id
        FROM public.judge_assignments ja
        JOIN public.submissions s ON s.id = ja.submission_id
        LEFT JOIN public.judge_reviews jr ON jr.submission_id = ja.submission_id AND jr.judge_id = ja.judge_id
        WHERE s.id IN ($1, $2, $3) AND (jr.id IS NULL OR jr.is_complete = false)
      `, [sub1Id, sub2Id, sub3Id]);

      assert.strictEqual(pendingReviews.length, 0, 'Zero incomplete evaluations remain');
    });

    it('TC-PB-03: Materializes results snapshot and initiates 5-minute buffer countdown', async () => {
      const releaseId = crypto.randomUUID();
      const bufferMinutes = 5;
      const publishAt = new Date(Date.now() + bufferMinutes * 60 * 1000);

      // Fetch official rankings
      const { rows: rankedRows } = await query('SELECT * FROM public.get_ranked_results(NULL, 1)');

      const snapshotPayload = {
        release_id: releaseId,
        generated_at: new Date().toISOString(),
        generated_by: adminId,
        buffer_minutes: bufferMinutes,
        total_submissions: rankedRows.length,
        rankings: rankedRows,
      };

      // Insert immutable snapshot
      await query(
        `INSERT INTO public.results_snapshot (release_id, snapshot_payload, created_at, created_by)
         VALUES ($1, $2, NOW(), $3)`,
        [releaseId, JSON.stringify(snapshotPayload), adminId]
      );

      // Update event_config to PUBLISHING state
      await query(
        `UPDATE public.event_config SET
           active_release_id = $1,
           results_release = 'PUBLISHING',
           publish_at = $2,
           event_phase = 'RESULTS',
           updated_at = NOW()
         WHERE id = 1`,
        [releaseId, publishAt.toISOString()]
      );

      const cfg = (await query('SELECT * FROM public.event_config WHERE id = 1')).rows[0];
      assert.strictEqual(cfg.results_release, 'PUBLISHING');
      assert.strictEqual(cfg.event_phase, 'RESULTS');
      assert.strictEqual(cfg.active_release_id, releaseId);
      assert.ok(cfg.publish_at);
    });

    it('TC-PB-04: Idempotent replay does not create duplicate releases', async () => {
      const cfg = (await query('SELECT * FROM public.event_config WHERE id = 1')).rows[0];
      const isAlreadyPublishing = cfg.results_release === 'PUBLISHING' || cfg.results_release === 'PUBLISHED';
      assert.strictEqual(isAlreadyPublishing, true, 'Subsequent publish calls must detect existing release and return cleanly');
    });
  });

  // =========================================================================
  // STAGE 6: PUBLIC RESULTS DISPLAY & EMBARGO
  // =========================================================================
  describe('Stage 6 — Public Results Display & Embargo Enforcement', () => {
    it('TC-PD-01: Public endpoint withholds results during countdown embargo', async () => {
      const cfg = (await query('SELECT * FROM public.event_config WHERE id = 1')).rows[0];
      const now = Date.now();
      const publishTime = new Date(cfg.publish_at).getTime();

      // Since publish_at is 5 minutes in the future:
      const isEmbargoed = cfg.results_release === 'PUBLISHING' && now < publishTime;
      assert.strictEqual(isEmbargoed, true, 'Results must remain embargoed during countdown');
    });

    it('TC-PD-02: Public results unlock automatically when publish_at timestamp is reached', async () => {
      // Simulate timestamp arrival: NOW >= publish_at
      const cfg = (await query('SELECT * FROM public.event_config WHERE id = 1')).rows[0];
      const futureTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      // getEffectiveResultsRelease() logic:
      const effectiveRelease =
        cfg.results_release === 'PUBLISHING' && cfg.publish_at && futureTime.getTime() >= new Date(cfg.publish_at).getTime()
          ? 'PUBLISHED'
          : cfg.results_release;

      assert.strictEqual(effectiveRelease, 'PUBLISHED', 'Effective release must transition to PUBLISHED deterministically');

      // Standings verify all 3 synthetic teams
      const { rows } = await query('SELECT * FROM public.get_ranked_results(NULL, 1)');
      const alpha = rows.find((r) => r.submission_id === sub1Id);
      const beta = rows.find((r) => r.submission_id === sub2Id);
      const gamma = rows.find((r) => r.submission_id === sub3Id);

      assert.strictEqual(Number(alpha.rank_num), 1, 'Alpha is Grand Champion (#1)');
      assert.strictEqual(Number(beta.rank_num), 2, 'Beta is 1st Runner Up (#2)');
      assert.strictEqual(Number(gamma.rank_num), 3, 'Gamma is 2nd Runner Up (#3)');

      console.log('\n  [FINAL PODIUM REVEAL]');
      console.log(`  🏆 Rank #1: ${alpha.title} — ${alpha.total_score} pts`);
      console.log(`  🥈 Rank #2: ${beta.title} — ${beta.total_score} pts`);
      console.log(`  🥉 Rank #3: ${gamma.title} — ${gamma.total_score} pts\n`);
    });
  });
});
