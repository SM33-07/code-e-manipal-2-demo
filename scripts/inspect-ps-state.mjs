import fs from 'fs';
import pg from 'pg';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    let val = v.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[k.trim()] = val;
  }
});

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    console.log('--- 1. event_config ---');
    const { rows: ec } = await client.query('SELECT id, event_phase, problem_statements_published, active_problem_release_id FROM public.event_config');
    console.log(ec);

    console.log('\n--- 2. problem_statement_releases ---');
    const { rows: rels } = await client.query('SELECT * FROM public.problem_statement_releases ORDER BY version_number ASC');
    console.log(rels);

    console.log('\n--- 3. problem_statement_drafts count by release_id & is_approved_for_release ---');
    const { rows: drafts } = await client.query(`
      SELECT release_id, is_approved_for_release, category_state, count(*)::int as count 
      FROM public.problem_statement_drafts 
      GROUP BY release_id, is_approved_for_release, category_state
    `);
    console.log(drafts);

    console.log('\n--- 4. Calling getPublicProblemStatements locally ---');
    const { getPublicProblemStatements } = await import('../services/problemStatementService.ts');
    const pub = await getPublicProblemStatements();
    console.log('isPublished:', pub.isPublished);
    console.log('release:', pub.release);
    console.log('statements count:', pub.statements?.length);
    console.log('tracks:', pub.tracks);

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
