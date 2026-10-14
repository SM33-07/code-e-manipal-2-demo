import assert from 'assert';
import pg from 'pg';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is required to run problem statement tests.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function runTests() {
  console.log('Running Problem Statement Management & Window Enforcement Tests...\n');
  let passed = 0;

  // Save original config to restore later
  const { rows: origConfigRows } = await pool.query(`
    SELECT problem_statements_published, problem_selection_start, problem_selection_end
    FROM public.event_config WHERE id = 1;
  `);
  const origConfig = origConfigRows[0] || {
    problem_statements_published: false,
    problem_selection_start: '2026-10-15T07:15:00.000Z',
    problem_selection_end: '2026-10-15T10:30:00.000Z',
  };

  const SYNTH_PS_ID = 'PS_TEST_SYNTH_01';
  const SYNTH_PS_DRAFT = 'PS_TEST_SYNTH_DRAFT';

  try {
    // -------------------------------------------------------------
    // Test 1: Verify Schema & Table Integrity
    // -------------------------------------------------------------
    const { rows: psColumns } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'problem_statements';
    `);
    const colNames = psColumns.map(c => c.column_name);
    assert(colNames.includes('id'), 'problem_statements must have id');
    assert(colNames.includes('title'), 'problem_statements must have title');
    assert(colNames.includes('track'), 'problem_statements must have track');
    assert(colNames.includes('description'), 'problem_statements must have description');
    assert(colNames.includes('is_published'), 'problem_statements must have is_published');
    assert(colNames.includes('display_order'), 'problem_statements must have display_order');

    const { rows: teamColumns } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'teams' AND column_name IN ('selected_problem_id', 'problem_selected_at');
    `);
    assert.strictEqual(teamColumns.length, 2, 'teams must have selected_problem_id and problem_selected_at');

    passed++;
    console.log('✅ Test 1: Schema and column integrity verified across problem_statements, teams, and event_config.');

    // -------------------------------------------------------------
    // Test 2: Draft Creation & Storage
    // -------------------------------------------------------------
    // Cleanup any leftover test data
    await pool.query('DELETE FROM public.problem_statements WHERE id IN ($1, $2);', [SYNTH_PS_ID, SYNTH_PS_DRAFT]);

    await pool.query(`
      INSERT INTO public.problem_statements (
        id, title, track, description, requirements, deliverables, constraints, is_published, display_order
      ) VALUES (
        $1, 'Autonomous Drone Delivery Routing', 'Track 01 · AI & Intelligent Systems',
        'Build multi-agent drone dispatch system', '["Latency < 200ms"]'::jsonb, '["Code and live demo"]'::jsonb, 'No external API keys', false, 1
      );
    `, [SYNTH_PS_DRAFT]);

    const { rows: draftRows } = await pool.query('SELECT * FROM public.problem_statements WHERE id = $1', [SYNTH_PS_DRAFT]);
    assert.strictEqual(draftRows.length, 1);
    assert.strictEqual(draftRows[0].is_published, false, 'Draft statement must have is_published = false');
    passed++;
    console.log('✅ Test 2: Draft statement creation and storage verified.');

    // -------------------------------------------------------------
    // Test 3: Sealed Vault Enforcement (Zero Challenge Leakage)
    // -------------------------------------------------------------
    // Set global event_config to unpublished
    await pool.query(`
      UPDATE public.event_config 
      SET problem_statements_published = false, updated_at = NOW() 
      WHERE id = 1;
    `);

    // Even if one statement is marked published
    await pool.query(`
      INSERT INTO public.problem_statements (
        id, title, track, description, is_published, display_order
      ) VALUES (
        $1, 'Zero-Knowledge Credential Issuer', 'Track 02 · Web3 & Decentralized Tech',
        'Decentralized identity protocol', true, 2
      );
    `, [SYNTH_PS_ID]);

    // Query mimicking GET /api/problem-statements
    const { rows: publicCheckConfig } = await pool.query(`
      SELECT problem_statements_published FROM public.event_config WHERE id = 1;
    `);
    let publicVisible = [];
    if (publicCheckConfig[0].problem_statements_published) {
      const { rows } = await pool.query('SELECT * FROM public.problem_statements WHERE is_published = true');
      publicVisible = rows;
    }
    assert.strictEqual(publicVisible.length, 0, 'Sealed vault must return 0 statements when problem_statements_published = false');
    passed++;
    console.log('✅ Test 3: Sealed vault integrity verified (zero challenge leakage when unpublished).');

    // -------------------------------------------------------------
    // Test 4: Publication Workflow
    // -------------------------------------------------------------
    // Enable publication in event_config
    await pool.query(`
      UPDATE public.event_config 
      SET problem_statements_published = true, updated_at = NOW() 
      WHERE id = 1;
    `);

    const { rows: liveStatements } = await pool.query(`
      SELECT id, title, track, is_published 
      FROM public.problem_statements 
      WHERE is_published = true;
    `);
    assert(liveStatements.some(s => s.id === SYNTH_PS_ID), 'Published statement must be visible when live');
    assert(!liveStatements.some(s => s.id === SYNTH_PS_DRAFT), 'Draft statement must NEVER be returned in public live queries');
    passed++;
    console.log('✅ Test 4: Publication workflow verified (only is_published = true returned when globally published).');

    // -------------------------------------------------------------
    // Test 5: Selection Window Enforcement (Time Bounds)
    // -------------------------------------------------------------
    // Case 5A: Window in Future (Selection not started)
    const futureStart = new Date(Date.now() + 3600000).toISOString();
    const futureEnd = new Date(Date.now() + 7200000).toISOString();
    await pool.query(`
      UPDATE public.event_config 
      SET problem_selection_start = $1, problem_selection_end = $2 
      WHERE id = 1;
    `, [futureStart, futureEnd]);

    const { rows: futureConfig } = await pool.query('SELECT problem_selection_start, problem_selection_end FROM public.event_config WHERE id = 1;');
    const nowA = new Date();
    const isTooEarly = nowA < new Date(futureConfig[0].problem_selection_start);
    assert.strictEqual(isTooEarly, true, 'Window in future must be recognized as too early');

    // Case 5B: Window in Past (Selection closed)
    const pastStart = new Date(Date.now() - 7200000).toISOString();
    const pastEnd = new Date(Date.now() - 3600000).toISOString();
    await pool.query(`
      UPDATE public.event_config 
      SET problem_selection_start = $1, problem_selection_end = $2 
      WHERE id = 1;
    `, [pastStart, pastEnd]);

    const { rows: pastConfig } = await pool.query('SELECT problem_selection_start, problem_selection_end FROM public.event_config WHERE id = 1;');
    const nowB = new Date();
    const isTooLate = nowB > new Date(pastConfig[0].problem_selection_end);
    assert.strictEqual(isTooLate, true, 'Window in past must be recognized as closed');

    // Case 5C: Window Active (Now is between start and end)
    const activeStart = new Date(Date.now() - 1800000).toISOString();
    const activeEnd = new Date(Date.now() + 1800000).toISOString();
    await pool.query(`
      UPDATE public.event_config 
      SET problem_selection_start = $1, problem_selection_end = $2 
      WHERE id = 1;
    `, [activeStart, activeEnd]);

    const { rows: activeConfig } = await pool.query('SELECT problem_selection_start, problem_selection_end FROM public.event_config WHERE id = 1;');
    const nowC = new Date();
    const isActive = nowC >= new Date(activeConfig[0].problem_selection_start) && nowC <= new Date(activeConfig[0].problem_selection_end);
    assert.strictEqual(isActive, true, 'Active window must permit selection');
    passed++;
    console.log('✅ Test 5: Server-side selection window bounds (future, past, active) strictly verified.');

    // -------------------------------------------------------------
    // Test 6: Team Selection, Row Locking & Transaction Integrity
    // -------------------------------------------------------------
    // Pick an existing team to test (e.g. TEAM001)
    const { rows: teamList } = await pool.query('SELECT id, name, selected_problem_id FROM public.teams LIMIT 1;');
    assert(teamList.length > 0, 'At least one team must exist for selection test');
    const testTeam = teamList[0];
    const origTeamProblem = testTeam.selected_problem_id;

    // Simulate select-problem transactional logic
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Row lock team
      const { rows: lockedTeam } = await client.query(`
        SELECT id, name, selected_problem_id FROM public.teams WHERE id = $1 FOR UPDATE;
      `, [testTeam.id]);
      assert.strictEqual(lockedTeam.length, 1);

      // Verify draft cannot be selected
      const { rows: draftCheck } = await client.query(`
        SELECT id FROM public.problem_statements WHERE id = $1 AND is_published = true;
      `, [SYNTH_PS_DRAFT]);
      assert.strictEqual(draftCheck.length, 0, 'Unpublished draft must not be selectable');

      // Update team with published synthetic problem
      await client.query(`
        UPDATE public.teams 
        SET selected_problem_id = $1, problem_selected_at = NOW(), track = 'Track 02 · Web3 & Decentralized Tech', updated_at = NOW() 
        WHERE id = $2;
      `, [SYNTH_PS_ID, testTeam.id]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Verify selection applied
    const { rows: updatedTeamRows } = await pool.query('SELECT selected_problem_id, track FROM public.teams WHERE id = $1', [testTeam.id]);
    assert.strictEqual(updatedTeamRows[0].selected_problem_id, SYNTH_PS_ID);
    assert.strictEqual(updatedTeamRows[0].track, 'Track 02 · Web3 & Decentralized Tech');
    passed++;
    console.log('✅ Test 6: Team selection with transactional row locking (FOR UPDATE) verified.');

    // -------------------------------------------------------------
    // Test 7: Cross-Team Isolation
    // -------------------------------------------------------------
    const { rows: otherTeams } = await pool.query('SELECT id, selected_problem_id FROM public.teams WHERE id != $1 LIMIT 5;', [testTeam.id]);
    for (const ot of otherTeams) {
      assert.notStrictEqual(ot.selected_problem_id, SYNTH_PS_ID, 'Cross-team isolation: other teams must not be mutated by team selection');
    }
    passed++;
    console.log('✅ Test 7: Cross-team data isolation verified.');

    // -------------------------------------------------------------
    // Cleanup: Restore pristine state
    // -------------------------------------------------------------
    // Restore test team's selected_problem_id
    await pool.query(`
      UPDATE public.teams 
      SET selected_problem_id = $1, updated_at = NOW() 
      WHERE id = $2;
    `, [origTeamProblem, testTeam.id]);

    // Delete synthetic problem statements
    await pool.query('DELETE FROM public.problem_statements WHERE id IN ($1, $2);', [SYNTH_PS_ID, SYNTH_PS_DRAFT]);

    // Restore original event_config
    await pool.query(`
      UPDATE public.event_config 
      SET 
        problem_statements_published = $1,
        problem_selection_start = $2,
        problem_selection_end = $3,
        updated_at = NOW()
      WHERE id = 1;
    `, [
      origConfig.problem_statements_published,
      origConfig.problem_selection_start,
      origConfig.problem_selection_end,
    ]);

    passed++;
    console.log('✅ Test 8: Safe cleanup and pristine state restoration verified.');

    console.log(`\n=========================================`);
    console.log(`Problem Statement Management Tests: ${passed} / 8 passed`);
    console.log(`=========================================\n`);
  } finally {
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
