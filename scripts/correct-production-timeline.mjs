#!/usr/bin/env node
/**
 * ============================================================================
 * Production Timeline Correction Script — Code-e-Manipal 2.0
 * File: scripts/correct-production-timeline.mjs
 *
 * AUTHORIZED USE ONLY — Must be run against production with explicit sign-off.
 *
 * This script corrects the 9 timeline events already seeded on 2026-10-14
 * and inserts the missing 10th event (Lunch, Day 2) to match UPDATED TIMELINE.pdf.
 *
 * Idempotent: safe to re-run. Uses targeted UPDATE WHERE title= and
 * INSERT ... ON CONFLICT DO NOTHING.
 * ============================================================================
 */
import pg from 'pg';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const dbName = dbUrl.split('/').pop().split('?')[0];
console.log(`Target database: ${dbName}`);

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function correct() {
  const client = await pool.connect();
  try {
    console.log('\n=== Current timeline_events (before correction) ===');
    const { rows: before } = await client.query(
      'SELECT display_order, title, day_label, venue FROM public.timeline_events ORDER BY display_order'
    );
    before.forEach(r => console.log(`  [${r.display_order}] ${r.day_label} | ${r.title} | venue=${r.venue}`));

    await client.query('BEGIN');

    const r1 = await client.query(
      `UPDATE public.timeline_events SET venue = 'ABI', updated_at = NOW()
       WHERE title = 'Registration Open' AND day_label = 'DAY 1' AND (venue IS NULL OR venue != 'ABI') RETURNING title`
    );
    console.log(`\nRegistration Open venue: ${r1.rowCount} row(s) updated`);

    const r2 = await client.query(
      `UPDATE public.timeline_events SET venue = 'Vasanti Pai', updated_at = NOW()
       WHERE title = 'Opening Ceremony' AND day_label = 'DAY 1' AND (venue IS NULL OR venue != 'Vasanti Pai') RETURNING title`
    );
    console.log(`Opening Ceremony venue: ${r2.rowCount} row(s) updated`);

    const r3 = await client.query(
      `UPDATE public.timeline_events SET venue = 'Old Mess, AB1', updated_at = NOW()
       WHERE title = 'Dinner' AND day_label = 'DAY 1' AND (venue IS NULL OR venue = 'Old Mess') RETURNING title`
    );
    console.log(`Dinner venue: ${r3.rowCount} row(s) updated`);

    const r4 = await client.query(
      `UPDATE public.timeline_events SET venue = 'Old Mess, AB1', updated_at = NOW()
       WHERE title = 'Breakfast' AND day_label = 'DAY 2' AND (venue IS NULL OR venue != 'Old Mess, AB1') RETURNING title`
    );
    console.log(`Breakfast venue: ${r4.rowCount} row(s) updated`);

    const r5 = await client.query(
      `UPDATE public.timeline_events SET venue = 'Vasanti Pai', display_order = 9, updated_at = NOW()
       WHERE title = 'Final Round 3 Judging' AND day_label = 'DAY 2' RETURNING title, display_order`
    );
    console.log(`Final Round 3 Judging: ${r5.rowCount} row(s) updated`);

    const r6 = await client.query(
      `UPDATE public.timeline_events SET venue = 'Vasanti Pai', display_order = 10, updated_at = NOW()
       WHERE title = 'Result & Closing Ceremony' AND day_label = 'DAY 2' RETURNING title, display_order`
    );
    console.log(`Result & Closing Ceremony: ${r6.rowCount} row(s) updated`);

    const r7 = await client.query(
      `INSERT INTO public.timeline_events (
         title, day_label, time_range, start_time, end_time, venue, description,
         card_position, display_order, status, event_type, is_published
       )
       SELECT 'Lunch','DAY 2','12:00 PM \u2013 1:00 PM','12:00 PM','1:00 PM',
              'Old Mess, AB1',NULL,'left',8,'upcoming','hospitality',true
       WHERE NOT EXISTS (
         SELECT 1 FROM public.timeline_events WHERE title = 'Lunch' AND day_label = 'DAY 2'
       )
       RETURNING title`
    );
    console.log(`Lunch (Day 2) insert: ${r7.rowCount} row(s) inserted`);

    await client.query('COMMIT');

    console.log('\n=== Corrected timeline_events (after correction) ===');
    const { rows: after } = await client.query(
      'SELECT display_order, title, day_label, venue, is_published FROM public.timeline_events ORDER BY display_order'
    );
    after.forEach(r => console.log(`  [${r.display_order}] ${r.day_label} | ${r.title} | venue=${r.venue} | published=${r.is_published}`));
    console.log(`\nTotal events: ${after.length}`);
    console.log(after.length === 10 ? '\u2705 10 events confirmed.' : `\u26a0\ufe0f Expected 10, found ${after.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\u274c Rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

correct().catch(err => { console.error(err); process.exit(1); });
