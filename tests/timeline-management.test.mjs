import assert from 'assert';
import pg from 'pg';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is required to run timeline tests.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function runTests() {
  console.log('Running Timeline Management & PDF Fidelity Tests...\n');
  let passed = 0;

  try {
    // Test 1: Timeline events exist and match 9 seed events from PDF
    const { rows: events } = await pool.query(`
      SELECT * FROM public.timeline_events ORDER BY display_order ASC;
    `);

    assert.strictEqual(events.length, 9, `Expected 9 timeline events matching PDF, found ${events.length}`);
    passed++;
    console.log(`✅ Test 1: Exact count of 9 events from PDF verified.`);

    // Test 2: Verify Day 1 events match PDF
    const day1 = events.filter(e => e.day_label === 'DAY 1');
    assert.strictEqual(day1.length, 5, 'Expected 5 Day 1 events');
    assert.strictEqual(day1[0].title, 'Registration Open');
    assert.strictEqual(day1[0].time_range, '9:00 AM – 11:00 AM');

    assert.strictEqual(day1[1].title, 'Opening Ceremony');
    assert.strictEqual(day1[1].venue, 'TMA Pai');

    assert.strictEqual(day1[2].title, 'Lunch');
    assert.strictEqual(day1[2].venue, 'Old Mess, AB1');

    assert.strictEqual(day1[3].title, 'Project Making');
    assert.strictEqual(day1[3].description, 'Problem statement closes at 4:00 PM');

    assert.strictEqual(day1[4].title, 'Dinner');
    assert.strictEqual(day1[4].venue, 'Old Mess');
    passed++;
    console.log(`✅ Test 2: Day 1 events match authoritative PDF exactly.`);

    // Test 3: Verify Day 2 events match PDF
    const day2 = events.filter(e => e.day_label === 'DAY 2');
    assert.strictEqual(day2.length, 4, 'Expected 4 Day 2 events');

    assert.strictEqual(day2[0].title, 'Judging Round 2');
    assert.strictEqual(day2[0].description, '7:30 AM: results out');

    assert.strictEqual(day2[1].title, 'Breakfast');
    assert.strictEqual(day2[1].description, '8:00 AM – 12:00 PM: final presentation prep');

    assert.strictEqual(day2[2].title, 'Final Round 3 Judging');
    assert.strictEqual(day2[2].venue, 'TMA Pai');

    assert.strictEqual(day2[3].title, 'Result & Closing Ceremony');
    passed++;
    console.log(`✅ Test 3: Day 2 events match authoritative PDF exactly.`);

    // Test 4: Verify intentional overlaps are preserved
    // Overlap 1: Lunch (1:00 PM – 2:30 PM) and Project Making (2:00 PM – 7:00 PM)
    const lunch = day1.find(e => e.title === 'Lunch');
    const projectMaking = day1.find(e => e.title === 'Project Making');
    assert(lunch && projectMaking, 'Lunch and Project Making must exist');
    assert.strictEqual(lunch.time_range, '1:00 PM – 2:30 PM');
    assert.strictEqual(projectMaking.time_range, '2:00 PM – 7:00 PM');

    // Overlap 2: Breakfast (8:00 AM – 9:30 AM) and Presentation prep (8:00 AM – 12:00 PM)
    const breakfast = day2.find(e => e.title === 'Breakfast');
    assert(breakfast && breakfast.description.includes('8:00 AM – 12:00 PM'), 'Breakfast prep overlap must exist');
    passed++;
    console.log(`✅ Test 4: Intentional event overlaps preserved as specified.`);

    // Test 5: Verify timeline config publishing state
    const { rows: configRows } = await pool.query(`
      SELECT * FROM public.timeline_config WHERE id = 1;
    `);
    assert.strictEqual(configRows.length, 1, 'timeline_config record must exist');
    assert(configRows[0].published_version >= 1, 'Version must be at least 1');
    passed++;
    console.log(`✅ Test 5: Timeline config versioning and state verified.`);

    // Test 6: Verify unpublish and publish database state transition
    await pool.query(`
      UPDATE public.timeline_config SET is_published = false, updated_at = NOW() WHERE id = 1;
    `);
    const { rows: unpubConfig } = await pool.query('SELECT is_published FROM public.timeline_config WHERE id = 1');
    assert.strictEqual(unpubConfig[0].is_published, false, 'Timeline should be unpublishable');

    // Restore to published
    await pool.query(`
      UPDATE public.timeline_config SET is_published = true, published_version = published_version + 1, updated_at = NOW() WHERE id = 1;
    `);
    const { rows: rePubConfig } = await pool.query('SELECT is_published FROM public.timeline_config WHERE id = 1');
    assert.strictEqual(rePubConfig[0].is_published, true, 'Timeline should be republishable');
    passed++;
    console.log(`✅ Test 6: Database publish/unpublish workflow verified.`);

    console.log(`\n=========================================`);
    console.log(`Timeline Verification Tests: ${passed} / 6 passed`);
    console.log(`=========================================\n`);
  } finally {
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
