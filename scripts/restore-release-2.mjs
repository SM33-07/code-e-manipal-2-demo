import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function restore() {
  console.log('Restoring Release v2 and cleaning test releases...');

  // 1. Delete any release with version >= 3
  const { rows: testReleases } = await pool.query(
    'SELECT id, version_number FROM public.problem_statement_releases WHERE version_number >= 3;'
  );
  for (const r of testReleases) {
    console.log(`Deleting test release v${r.version_number} (${r.id})...`);
    await pool.query('DELETE FROM public.problem_statement_drafts WHERE release_id = $1;', [r.id]);
    await pool.query('DELETE FROM public.problem_statement_audit_logs WHERE release_id = $1;', [r.id]);
    await pool.query('DELETE FROM public.problem_statement_releases WHERE id = $1;', [r.id]);
  }

  // 2. Set Release v1 to draft, unpublished
  await pool.query(
    "UPDATE public.problem_statement_releases SET status = 'draft', is_current_published = false WHERE version_number = 1;"
  );

  // 3. Set Release v2 to published, current published
  const { rows: v2Rows } = await pool.query(
    "UPDATE public.problem_statement_releases SET status = 'published', is_current_published = true, published_at = NOW() WHERE version_number = 2 RETURNING id;"
  );

  if (v2Rows.length > 0) {
    const v2Id = v2Rows[0].id;
    await pool.query(
      `UPDATE public.event_config 
       SET problem_statements_published = true, active_problem_release_id = $1, updated_at = NOW() 
       WHERE id = 1;`,
      [v2Id]
    );
    console.log(`Activated Release v2 (${v2Id}) in event_config.`);
  }

  console.log('Environment successfully restored to Release v2 live.');
  await pool.end();
}

restore().catch((err) => {
  console.error(err);
  process.exit(1);
});
