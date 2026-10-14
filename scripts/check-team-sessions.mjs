import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkTeamSessions() {
  const { rows } = await pool.query(`
    SELECT p.login_id, t.name, count(s.session_id) as session_count
    FROM public.profiles p
    JOIN public.teams t ON t.id = p.team_id
    LEFT JOIN public.team_active_sessions s ON s.team_id = t.id AND s.is_revoked = FALSE AND s.expires_at >= NOW()
    WHERE p.role = 'participant'
    GROUP BY p.login_id, t.name
    ORDER BY session_count DESC
    LIMIT 15
  `);

  console.log('Top team session counts:');
  console.log(rows);
  await pool.end();
}

checkTeamSessions().catch(err => {
  console.error(err);
  process.exit(1);
});
