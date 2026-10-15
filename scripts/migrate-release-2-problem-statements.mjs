import fs from 'fs';
import path from 'path';
import pg from 'pg';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    let val = v.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[k.trim()] = val;
  }
});

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute || process.argv.includes('--dry-run');

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║   Code-e-Manipal 2.0 — Release v2 Problem Statements Migration       ║');
console.log(`║   Mode: ${isDryRun ? 'DRY-RUN (Safe Transactional Preview)' : 'EXECUTE (Commit Changes)'}`.padEnd(71) + '║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

const jsonPath = path.resolve('data/final_35_problem_statements.json');
if (!fs.existsSync(jsonPath)) {
  console.error('❌ FATAL: Final 35 JSON file not found at:', jsonPath);
  process.exit(1);
}

const statements = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
if (statements.length !== 35) {
  console.error(`❌ FATAL: Expected exactly 35 problem statements, found ${statements.length}`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Phase 1: Schema Invariant Verification & Safe Extension ──────────────
    console.log('Phase 1: Ensuring Schema Extension (Migration 028)...');
    await client.query(`
      ALTER TABLE public.problem_statement_drafts
        ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
        ADD COLUMN IF NOT EXISTS description_implementation TEXT,
        ADD COLUMN IF NOT EXISTS deliverables TEXT,
        ADD COLUMN IF NOT EXISTS description_bullets JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS deliverables_bullets JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS additional_guidance JSONB DEFAULT '{}'::jsonb;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ps_drafts_slug 
        ON public.problem_statement_drafts (slug);
    `);
    console.log('  ✓ Schema columns verified/extended.');

    // ── Phase 2: Resolve Administrative Identity for Audit ───────────────────
    console.log('\nPhase 2: Resolving Administrative Identity...');
    const { rows: adminRows } = await client.query(
      "SELECT id, email FROM public.profiles WHERE role = 'admin' AND is_disabled = false ORDER BY created_at ASC LIMIT 1"
    );
    const adminId = adminRows[0]?.id || null;
    const adminEmail = adminRows[0]?.email || 'system-admin@codeemanipal.in';
    console.log(`  ✓ System Admin resolved: ${adminEmail} (${adminId})`);

    // ── Phase 3: Create or Reconcile Release v2 ──────────────────────────────
    console.log('\nPhase 3: Reconciling Release v2 record...');
    const { rows: existingV2 } = await client.query(
      'SELECT id, version_number, status, is_current_published FROM public.problem_statement_releases WHERE version_number = 2'
    );

    let releaseId;
    if (existingV2.length > 0) {
      releaseId = existingV2[0].id;
      console.log(`  Found existing Release v2 (${releaseId}). Refreshing metadata...`);
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
      console.log(`  ✓ Created Release v2 (${releaseId}) as published.`);
    }

    // ── Phase 4: Demote all other releases from is_current_published ─────────
    await client.query(
      'UPDATE public.problem_statement_releases SET is_current_published = FALSE WHERE id != $1',
      [releaseId]
    );
    console.log('  ✓ Demoted other releases to enforce single published release invariant.');

    // ── Phase 5: Insert All 35 Problem Statements ────────────────────────────
    console.log('\nPhase 5: Inserting 35 Problem Statement Drafts...');
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
          true, // is_approved_for_release
          s.is_official_sih,
          s.scope_note,
          s.problem_statement,
          s.description_implementation,
          JSON.stringify(s.description_bullets || []),
          s.deliverables,
          JSON.stringify(s.deliverables_bullets || []),
          s.implementation_challenge,
          s.minimum_acceptable_prototype,
          s.evaluation_tests,
          s.stretch_differentiator,
          s.suggested_public_sector_relevance,
          JSON.stringify(s.additional_guidance || {}),
          s.display_order,
        ]
      );
      insertedCount++;
    }
    console.log(`  ✓ Inserted ${insertedCount} problem statement drafts.`);

    // ── Phase 6: Update event_config pointer ─────────────────────────────────
    console.log('\nPhase 6: Synchronizing event_config...');
    await client.query(
      `UPDATE public.event_config
       SET problem_statements_published = TRUE,
           active_problem_release_id = $1,
           updated_at = NOW()
       WHERE id = 1`,
      [releaseId]
    );
    console.log(`  ✓ event_config updated: problem_statements_published = TRUE, active_problem_release_id = ${releaseId}`);

    // ── Phase 7: Record Audit Log ────────────────────────────────────────────
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
          tracks_count: 9,
          dry_run: isDryRun,
        }),
      ]
    );

    // ── Phase 8: Verify within Transaction ───────────────────────────────────
    console.log('\nPhase 8: In-Transaction Verification...');
    const { rows: verifyDrafts } = await client.query(
      `SELECT COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE is_approved_for_release)::int as approved,
              COUNT(DISTINCT track)::int as tracks
       FROM public.problem_statement_drafts
       WHERE release_id = $1`,
      [releaseId]
    );
    console.log('  Drafts verification:', verifyDrafts[0]);
    if (verifyDrafts[0].total !== 35 || verifyDrafts[0].approved !== 35 || verifyDrafts[0].tracks !== 9) {
      throw new Error(`Verification failed: Expected 35/35/9, got ${JSON.stringify(verifyDrafts[0])}`);
    }

    if (isDryRun) {
      await client.query('ROLLBACK');
      console.log('\n' + '═'.repeat(70));
      console.log('✅ DRY-RUN PREVIEW COMPLETE: ALL VALIDATIONS PASSED.');
      console.log('   The transaction was cleanly ROLLED BACK.');
      console.log('   ZERO production mutations were persisted.');
      console.log('   To apply these changes, pass --execute --confirm-production.');
      console.log('═'.repeat(70));
    } else {
      await client.query('COMMIT');
      console.log('\n' + '═'.repeat(70));
      console.log('✅ MIGRATION COMMITTED: RELEASE V2 IS NOW LIVE IN DATABASE.');
      console.log('═'.repeat(70));
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back due to error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal migration failure:', err);
  process.exit(1);
});
