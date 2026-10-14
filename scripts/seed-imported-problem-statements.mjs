import fs from 'fs';
import path from 'path';
import pg from 'pg';

const jsonPath = 'C:\\Users\\SOHAM\\.gemini\\antigravity-ide\\brain\\a7dde7aa-305a-4868-b5c8-d720a23dd118\\extracted_32_problem_statements.json';
if (!fs.existsSync(jsonPath)) {
  console.error('Extracted JSON file not found at:', jsonPath);
  process.exit(1);
}

const briefs = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`Loaded ${briefs.length} briefs from extraction JSON.`);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();

try {
  await client.query('BEGIN');

  // 1. Create or get Version 1 Release
  const { rows: existingReleases } = await client.query(
    'SELECT id FROM public.problem_statement_releases WHERE version_number = 1'
  );

  let releaseId;
  if (existingReleases.length > 0) {
    releaseId = existingReleases[0].id;
    console.log('Found existing Release v1:', releaseId);
    // Clean existing drafts for v1
    await client.query('DELETE FROM public.problem_statement_drafts WHERE release_id = $1', [releaseId]);
  } else {
    const { rows: newRelease } = await client.query(`
      INSERT INTO public.problem_statement_releases (
        version_number, label, status, is_current_published, release_notes
      ) VALUES (
        1, 'Technical Review Edition (Working Set)', 'draft', FALSE,
        'Initial faithful import of 32 briefs from 35-page Refined Problem Statements — Technical Review Edition.'
      ) RETURNING id;
    `);
    releaseId = newRelease[0].id;
    console.log('Created Release v1:', releaseId);
  }

  // 2. Insert all 32 drafts
  for (const b of briefs) {
    await client.query(`
      INSERT INTO public.problem_statement_drafts (
        release_id, challenge_num, track_num, track, original_ref_id,
        proposed_id, title, difficulty, build_type, review_status,
        category_state, is_approved_for_release, is_official_sih,
        scope_note, problem_statement, implementation_challenge,
        minimum_acceptable_prototype, evaluation_tests,
        stretch_differentiator, suggested_public_sector_relevance,
        display_order
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18,
        $19, $20,
        $21
      )
    `, [
      releaseId,
      b.challenge_num,
      b.track_num,
      b.track,
      b.original_ref_id,
      b.proposed_id,
      b.title,
      b.difficulty,
      b.build_type,
      b.review_status,
      b.category_state,
      false, // is_approved_for_release starts false
      b.is_official_sih,
      b.scope_note || null,
      b.problem_statement,
      b.implementation_challenge,
      b.minimum_acceptable_prototype,
      b.evaluation_tests,
      b.stretch_differentiator,
      b.suggested_public_sector_relevance || null,
      b.challenge_num,
    ]);
  }

  // 3. Log audit action
  await client.query(`
    INSERT INTO public.problem_statement_audit_logs (
      action, release_id, metadata
    ) VALUES (
      'IMPORT_SOURCE_PDF', $1, $2::jsonb
    )
  `, [
    releaseId,
    JSON.stringify({
      total_briefs: briefs.length,
      selected: briefs.filter((b) => b.category_state === 'selected').length,
      hold: briefs.filter((b) => b.category_state === 'hold').length,
      new_proposals: briefs.filter((b) => b.category_state === 'new_proposal').length,
      source_document: 'Code-e-Manipal_2_0_Refined_Problem_Statements_Technical_Review.pdf',
    }),
  ]);

  await client.query('COMMIT');
  console.log(`Successfully seeded ${briefs.length} briefs into Release v1.`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Failed to seed briefs:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
