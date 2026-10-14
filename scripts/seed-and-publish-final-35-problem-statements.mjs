import fs from 'fs';
import path from 'path';
import pg from 'pg';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes('cem_staging')) {
  console.error('FATAL: Target must be cem_staging! dbUrl:', dbUrl);
  process.exit(1);
}

const jsonPath = path.resolve('data/final_35_problem_statements.json');
if (!fs.existsSync(jsonPath)) {
  console.error('Final 35 JSON not found at:', jsonPath);
  process.exit(1);
}

const statements = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
assert(statements.length === 35, `Expected 35 statements, got ${statements.length}`);

function assert(condition, message) {
  if (!condition) {
    console.error('ASSERTION FAILED:', message);
    process.exit(1);
  }
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Code-e-Manipal 2.0 — Final 35 Problem Statements Seed & Publication    ║');
  console.log('║   Target Environment: STAGING (cem_staging / ggmwribwynonpsvsmpyz)       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Resolve Admin ID for audit logging
    const { rows: adminRows } = await client.query(
      "SELECT id, email FROM public.profiles WHERE role = 'admin' AND is_disabled = false ORDER BY created_at ASC LIMIT 1"
    );
    const adminId = adminRows[0]?.id || null;
    const adminEmail = adminRows[0]?.email || 'system-admin@codeemanipal.in';

    // 2. Create or Update Release v2
    const { rows: existingV2 } = await client.query(
      'SELECT id, version_number, status, is_current_published FROM public.problem_statement_releases WHERE version_number = 2'
    );

    let releaseId;
    if (existingV2.length > 0) {
      releaseId = existingV2[0].id;
      console.log(`Found existing Release v2 (${releaseId}). Refreshing drafts...`);
      await client.query(
        `UPDATE public.problem_statement_releases
         SET label = 'Final Event Release — 35 Shortlisted Challenges',
             status = 'published',
             is_current_published = TRUE,
             published_by = $1,
             published_at = NOW(),
             updated_at = NOW(),
             release_notes = 'Official Code-e-Manipal 2.0 final 35 problem statements across 9 tracks extracted from authoritative PDF.'
         WHERE id = $2`,
        [adminId, releaseId]
      );
      // Clean existing drafts for v2 to ensure clean idempotent insert
      await client.query('DELETE FROM public.problem_statement_drafts WHERE release_id = $1', [releaseId]);
    } else {
      const { rows: newRel } = await client.query(
        `INSERT INTO public.problem_statement_releases (
           version_number, label, status, is_current_published,
           created_by, published_by, published_at, release_notes
         ) VALUES (
           2, 'Final Event Release — 35 Shortlisted Challenges', 'published', TRUE,
           $1, $1, NOW(), 'Official Code-e-Manipal 2.0 final 35 problem statements across 9 tracks extracted from authoritative PDF.'
         ) RETURNING id`,
        [adminId]
      );
      releaseId = newRel[0].id;
      console.log(`Created Release v2 (${releaseId}) as published.`);
    }

    // 3. Demote all other releases from is_current_published
    await client.query(
      'UPDATE public.problem_statement_releases SET is_current_published = FALSE WHERE id != $1',
      [releaseId]
    );

    // 4. Insert all 35 statements into problem_statement_drafts
    let insertedCount = 0;
    for (const s of statements) {
      await client.query(
        `INSERT INTO public.problem_statement_drafts (
           release_id, challenge_num, track_num, track, original_ref_id,
           proposed_id, slug, title, difficulty, build_type, review_status,
           category_state, is_approved_for_release, is_official_sih,
           scope_note, problem_statement, description_implementation,
           description_bullets, deliverables, deliverables_bullets,
           implementation_challenge, minimum_acceptable_prototype,
           evaluation_tests, stretch_differentiator, suggested_public_sector_relevance,
           additional_guidance, display_order
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10, $11,
           $12, $13, $14,
           $15, $16, $17,
           $18::jsonb, $19, $20::jsonb,
           $21, $22,
           $23, $24, $25,
           $26::jsonb, $27
         )`,
        [
          releaseId,
          s.challenge_num,
          s.track_num,
          s.track,
          s.original_ref_id,
          s.proposed_id,
          s.slug,
          s.title,
          s.difficulty,
          s.build_type,
          s.review_status,
          s.category_state,
          true, // is_approved_for_release = true
          s.is_official_sih,
          s.scope_note,
          s.problem_statement,
          s.description_implementation,
          JSON.stringify(s.description_bullets),
          s.deliverables,
          JSON.stringify(s.deliverables_bullets),
          s.implementation_challenge,
          s.minimum_acceptable_prototype,
          s.evaluation_tests,
          s.stretch_differentiator,
          s.suggested_public_sector_relevance,
          JSON.stringify(s.additional_guidance),
          s.display_order,
        ]
      );
      insertedCount++;
    }

    // 5. Update event_config to activate release v2
    await client.query(
      `UPDATE public.event_config
       SET problem_statements_published = TRUE,
           active_problem_release_id = $1,
           updated_at = NOW()
       WHERE id = 1`,
      [releaseId]
    );

    // 6. Record audit log
    await client.query(
      `INSERT INTO public.problem_statement_audit_logs (
         action, release_id, actor_id, actor_email, metadata
       ) VALUES (
         'PUBLISH_FINAL_35_RELEASE', $1, $2, $3, $4::jsonb
       )`,
      [
        releaseId,
        adminId,
        adminEmail,
        JSON.stringify({
          version_number: 2,
          total_statements: insertedCount,
          source_pdf: 'Codee_Manipal_Revised_Problem_Statements_35.pdf',
        }),
      ]
    );

    await client.query('COMMIT');
    console.log(`\n✅ Successfully committed Release v2 with ${insertedCount} final problem statements!`);
    console.log(`✅ event_config.problem_statements_published set to TRUE.`);
    console.log(`✅ active_problem_release_id set to ${releaseId}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back due to error:', err);
    throw err;
  } finally {
    client.release();
  }

  // 7. Verify post-commit state
  const { rows: verifyConfig } = await pool.query(
    'SELECT problem_statements_published, active_problem_release_id FROM public.event_config WHERE id = 1'
  );
  console.log('\n--- Post-Commit Verification ---');
  console.log('event_config:', verifyConfig[0]);

  const { rows: verifyDrafts } = await pool.query(
    `SELECT COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE is_approved_for_release)::int as approved,
            COUNT(DISTINCT track)::int as tracks
     FROM public.problem_statement_drafts
     WHERE release_id = $1`,
    [verifyConfig[0].active_problem_release_id]
  );
  console.log('Release v2 Drafts Stats:', verifyDrafts[0]);

  assert(verifyDrafts[0].total === 35, `Expected 35 drafts, got ${verifyDrafts[0].total}`);
  assert(verifyDrafts[0].approved === 35, `Expected 35 approved drafts, got ${verifyDrafts[0].approved}`);
  assert(verifyDrafts[0].tracks === 9, `Expected 9 tracks, got ${verifyDrafts[0].tracks}`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal seed failure:', err);
  process.exit(1);
});
