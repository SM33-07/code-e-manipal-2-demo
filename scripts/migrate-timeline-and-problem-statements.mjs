import pg from 'pg';

const INITIAL_TIMELINE_EVENTS = [
  // Day 1
  {
    title: 'Registration Open',
    day_label: 'DAY 1',
    time_range: '9:00 AM – 11:00 AM',
    start_time: '9:00 AM',
    end_time: '11:00 AM',
    venue: null,
    description: null,
    card_position: 'right',
    display_order: 1,
    status: 'upcoming',
    event_type: 'hospitality',
  },
  {
    title: 'Opening Ceremony',
    day_label: 'DAY 1',
    time_range: '11:00 AM – 1:00 PM',
    start_time: '11:00 AM',
    end_time: '1:00 PM',
    venue: 'TMA Pai',
    description: null,
    card_position: 'left',
    display_order: 2,
    status: 'upcoming',
    event_type: 'ceremony',
  },
  {
    title: 'Lunch',
    day_label: 'DAY 1',
    time_range: '1:00 PM – 2:30 PM',
    start_time: '1:00 PM',
    end_time: '2:30 PM',
    venue: 'Old Mess, AB1',
    description: null,
    card_position: 'right',
    display_order: 3,
    status: 'upcoming',
    event_type: 'hospitality',
  },
  {
    title: 'Project Making',
    day_label: 'DAY 1',
    time_range: '2:00 PM – 7:00 PM',
    start_time: '2:00 PM',
    end_time: '7:00 PM',
    venue: null,
    description: 'Problem statement closes at 4:00 PM',
    card_position: 'left',
    display_order: 4,
    status: 'upcoming',
    event_type: 'hack',
  },
  {
    title: 'Dinner',
    day_label: 'DAY 1',
    time_range: '8:00 PM – 9:30 PM',
    start_time: '8:00 PM',
    end_time: '9:30 PM',
    venue: 'Old Mess',
    description: null,
    card_position: 'right',
    display_order: 5,
    status: 'upcoming',
    event_type: 'hospitality',
  },

  // Day 2
  {
    title: 'Judging Round 2',
    day_label: 'DAY 2',
    time_range: '6:00 AM – 7:30 AM',
    start_time: '6:00 AM',
    end_time: '7:30 AM',
    venue: null,
    description: '7:30 AM: results out',
    card_position: 'left',
    display_order: 6,
    status: 'upcoming',
    event_type: 'eval',
  },
  {
    title: 'Breakfast',
    day_label: 'DAY 2',
    time_range: '8:00 AM – 9:30 AM',
    start_time: '8:00 AM',
    end_time: '9:30 AM',
    venue: null,
    description: '8:00 AM – 12:00 PM: final presentation prep',
    card_position: 'right',
    display_order: 7,
    status: 'upcoming',
    event_type: 'hospitality',
  },
  {
    title: 'Final Round 3 Judging',
    day_label: 'DAY 2',
    time_range: '1:00 PM – 3:00 PM',
    start_time: '1:00 PM',
    end_time: '3:00 PM',
    venue: 'TMA Pai',
    description: null,
    card_position: 'left',
    display_order: 8,
    status: 'upcoming',
    event_type: 'eval',
  },
  {
    title: 'Result & Closing Ceremony',
    day_label: 'DAY 2',
    time_range: '3:00 PM – 5:00 PM',
    start_time: '3:00 PM',
    end_time: '5:00 PM',
    venue: null,
    description: null,
    card_position: 'right',
    display_order: 9,
    status: 'upcoming',
    event_type: 'awards',
  },
];

async function migrate(envName, dbUrl) {
  console.log(`\n================================================================`);
  console.log(`  Migrating Timeline & Problem Statements on [${envName}]`);
  console.log(`================================================================`);

  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Timeline Events Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.timeline_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        day_label VARCHAR(50) NOT NULL,
        time_range VARCHAR(100) NOT NULL,
        start_time VARCHAR(50),
        end_time VARCHAR(50),
        venue VARCHAR(255),
        description TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        card_position VARCHAR(10) NOT NULL DEFAULT 'right',
        status VARCHAR(20) NOT NULL DEFAULT 'upcoming',
        event_type VARCHAR(50) NOT NULL DEFAULT 'general',
        is_published BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_timeline_events_published_order 
      ON public.timeline_events(is_published, display_order);
    `);

    // 2. Timeline Config Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.timeline_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        is_published BOOLEAN NOT NULL DEFAULT true,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published_version INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO public.timeline_config (id, is_published, published_at, published_version)
      VALUES (1, true, NOW(), 1)
      ON CONFLICT (id) DO NOTHING;
    `);

    // 3. Problem Statements Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.problem_statements (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        track VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
        deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
        constraints TEXT,
        attachment_url TEXT,
        attachment_name VARCHAR(255),
        is_published BOOLEAN NOT NULL DEFAULT false,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_problem_statements_published 
      ON public.problem_statements(is_published, display_order);
    `);

    // 4. Team Problem Selection Columns
    await client.query(`
      ALTER TABLE public.teams 
      ADD COLUMN IF NOT EXISTS selected_problem_id VARCHAR(50) REFERENCES public.problem_statements(id),
      ADD COLUMN IF NOT EXISTS problem_selected_at TIMESTAMPTZ;
    `);

    // 5. Configurable Selection Windows in event_config
    await client.query(`
      ALTER TABLE public.event_config
      ADD COLUMN IF NOT EXISTS problem_selection_start TIMESTAMPTZ DEFAULT '2026-10-15T12:45:00+05:30',
      ADD COLUMN IF NOT EXISTS problem_selection_end TIMESTAMPTZ DEFAULT '2026-10-15T16:00:00+05:30';
    `);

    // 6. Seed Timeline Events if empty
    const { rows: existingTimeline } = await client.query('SELECT count(*)::int as count FROM public.timeline_events');
    if (existingTimeline[0].count === 0) {
      console.log('Seeding 9 initial timeline events from authoritative PDF...');
      for (const ev of INITIAL_TIMELINE_EVENTS) {
        await client.query(`
          INSERT INTO public.timeline_events (
            title, day_label, time_range, start_time, end_time, venue, description,
            card_position, display_order, status, event_type, is_published
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true);
        `, [
          ev.title,
          ev.day_label,
          ev.time_range,
          ev.start_time,
          ev.end_time,
          ev.venue,
          ev.description,
          ev.card_position,
          ev.display_order,
          ev.status,
          ev.event_type,
        ]);
      }
      console.log(`✅ Seeded ${INITIAL_TIMELINE_EVENTS.length} events successfully.`);
    } else {
      console.log(`Timeline table already contains ${existingTimeline[0].count} events. Preserving existing records.`);
    }

    await client.query('COMMIT');
    console.log(`✅ Migration committed successfully on ${envName}.\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed on ${envName}:`, err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  const envName = process.argv[2] || 'TARGET';
  await migrate(envName, dbUrl);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
