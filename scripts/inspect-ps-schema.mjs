import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const { rows: cols } = await pool.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'problem_statements'
  ORDER BY ordinal_position;
`);

console.log('Columns of problem_statements:');
console.table(cols);

const { rows: currentPs } = await pool.query(`
  SELECT id, title, track, is_published, display_order FROM public.problem_statements LIMIT 5;
`);
console.log('Sample rows:');
console.table(currentPs);

const { rows: tables } = await pool.query(`
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%problem%' OR table_name LIKE '%release%';
`);
console.log('Related tables:');
console.table(tables);

await pool.end();
