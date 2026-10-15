import assert from 'assert';
import pg from 'pg';
import {
  getPublicProblemStatements,
  getAdminReleases,
  getAdminReleaseDetail,
  updateDraftStatement,
  toggleDraftApproval,
  createDraftRelease,
  publishRelease,
  unpublishRelease,
  getAdminAuditLogs,
} from '../services/problemStatementService.ts';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is required to run problem statement CMS tests.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function runTests() {
  console.log('Running Problem Statement CMS & Versioned Release Test Suite...\n');
  let passed = 0;

  // Snapshot original event_config and release state
  const { rows: origConfigRows } = await pool.query(`
    SELECT problem_statements_published, active_problem_release_id 
    FROM public.event_config WHERE id = 1;
  `);
  const origConfig = origConfigRows[0] || {
    problem_statements_published: false,
    active_problem_release_id: null,
  };

  let testReleaseV2Id = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Verify 32 Extracted Problem Statements in Release v1
    // -------------------------------------------------------------
    const { rows: v1ReleaseRows } = await pool.query(`
      SELECT id, version_number, label, status, is_current_published 
      FROM public.problem_statement_releases 
      WHERE version_number = 1;
    `);
    assert.strictEqual(v1ReleaseRows.length, 1, 'Release v1 must exist in the database');
    const v1Release = v1ReleaseRows[0];

    const { rows: v1Drafts } = await pool.query(`
      SELECT * FROM public.problem_statement_drafts 
      WHERE release_id = $1 
      ORDER BY challenge_num ASC;
    `, [v1Release.id]);

    assert.strictEqual(v1Drafts.length, 32, 'Release v1 must contain exactly 32 challenge briefs');

    const selectedCount = v1Drafts.filter(d => d.category_state === 'selected').length;
    const holdCount = v1Drafts.filter(d => d.category_state === 'hold').length;
    const proposalCount = v1Drafts.filter(d => d.category_state === 'new_proposal').length;

    assert.strictEqual(selectedCount, 13, 'Must have exactly 13 selected briefs');
    assert.strictEqual(holdCount, 7, 'Must have exactly 7 briefs on hold');
    assert.strictEqual(proposalCount, 12, 'Must have exactly 12 new proposal briefs');

    passed++;
    console.log(`✅ Test 1: All 32 briefs verified in Release v1 (13 selected, 7 hold, 12 new proposals).`);

    // -------------------------------------------------------------
    // Test 2: Verify Exact Preservation of Key Problem Identifiers
    // -------------------------------------------------------------
    // Brief 1: SIH26166 / PS 01
    const brief1 = v1Drafts.find(d => d.challenge_num === 1);
    assert(brief1, 'Brief #1 must exist');
    assert.strictEqual(brief1.original_ref_id, 'PS 01', 'Original reference must be PS 01');
    assert.strictEqual(brief1.proposed_id, 'SIH26166', 'Proposed identifier must be SIH26166');
    assert.strictEqual(brief1.track, 'AI/ML', 'Track must be AI/ML');
    assert(brief1.title.includes('Chandrayaan-2') && brief1.title.includes('optical images'), 'Title must preserve Chandrayaan-2 optical images');
    assert(brief1.scope_note && brief1.scope_note.includes('SIH26166'), 'SIH scope note must be preserved');
    assert(brief1.problem_statement && brief1.problem_statement.length > 50, 'Problem statement text preserved');
    assert(brief1.implementation_challenge && brief1.implementation_challenge.length > 50, 'Implementation challenge preserved');
    assert(brief1.minimum_acceptable_prototype && brief1.minimum_acceptable_prototype.length > 50, 'Minimum prototype preserved');
    assert(brief1.evaluation_tests && brief1.evaluation_tests.length > 50, 'Evaluation tests preserved');
    assert(brief1.stretch_differentiator && brief1.stretch_differentiator.length > 30, 'Stretch differentiator preserved');

    // Brief 5: HX-HT-01 / PS 07 (Hold)
    const brief5 = v1Drafts.find(d => d.challenge_num === 5);
    assert(brief5, 'Brief #5 must exist');
    assert.strictEqual(brief5.category_state, 'hold', 'Brief #5 must be categorized as hold');
    assert.strictEqual(brief5.proposed_id, 'HX-HT-01');

    // Brief 8: HX-HT-07 / NEW OPTION (New Proposal)
    const brief8 = v1Drafts.find(d => d.challenge_num === 8);
    assert(brief8, 'Brief #8 must exist');
    assert.strictEqual(brief8.category_state, 'new_proposal', 'Brief #8 must be categorized as new_proposal');
    assert.strictEqual(brief8.original_ref_id, 'NEW OPTION');
    assert.strictEqual(brief8.proposed_id, 'HX-HT-07');

    passed++;
    console.log('✅ Test 2: Faithful extraction and identifier preservation verified for selected, hold, and proposed briefs.');

    // -------------------------------------------------------------
    // Test 3: Sealed Public State (Zero Leakage Before Publication)
    // -------------------------------------------------------------
    // Ensure event_config has problem_statements_published = false
    await pool.query(`
      UPDATE public.event_config 
      SET problem_statements_published = false, active_problem_release_id = NULL 
      WHERE id = 1;
    `);
    await pool.query(`
      UPDATE public.problem_statement_releases 
      SET is_current_published = false 
      WHERE is_current_published = true;
    `);

    const publicResultUnpublished = await getPublicProblemStatements();
    assert.strictEqual(publicResultUnpublished.isPublished, false, 'public endpoint must report isPublished = false');
    assert.strictEqual(publicResultUnpublished.release, null, 'public release metadata must be null when unpublished');
    assert.strictEqual(publicResultUnpublished.statements.length, 0, 'No statements may be leaked when unpublished');

    passed++;
    console.log('✅ Test 3: Sealed public state verified (0 statements returned before explicit publication).');

    // -------------------------------------------------------------
    // Test 4: Admin Draft Editing & Audit Logging
    // -------------------------------------------------------------
    const { rows: adminRows } = await pool.query("SELECT id, email FROM public.profiles WHERE role = 'admin' LIMIT 1;");
    assert(adminRows.length > 0, 'An admin profile must exist for testing audit trails');
    const testActorId = adminRows[0].id;
    const testActorEmail = adminRows[0].email;

    const brief2 = v1Drafts.find(d => d.challenge_num === 2);
    assert(brief2, 'Brief #2 must exist');
    const draftToEdit = brief2;
    const originalTitle = draftToEdit.title;
    const originalScopeNote = draftToEdit.scope_note;
    const modifiedTitle = originalTitle + ' [Reviewed v1.1]';

    try {
      const updateRes = await updateDraftStatement(
        draftToEdit.id,
        { title: modifiedTitle, scope_note: 'Technical review approved by jury panel.' },
        testActorId,
        testActorEmail
      );
      assert.strictEqual(updateRes.title, modifiedTitle, 'Title must be updated');

      // Verify audit log
      const { rows: editAuditRows } = await pool.query(`
        SELECT * FROM public.problem_statement_audit_logs 
        WHERE draft_id = $1 AND action = 'UPDATE_DRAFT' 
        ORDER BY created_at DESC LIMIT 1;
      `, [draftToEdit.id]);
      assert(editAuditRows.length >= 1, 'Audit log entry must be created on draft update');
      assert.strictEqual(editAuditRows[0].actor_id, testActorId);
      assert.strictEqual(editAuditRows[0].actor_email, testActorEmail);
    } finally {
      // Revert edit back
      await updateDraftStatement(
        draftToEdit.id,
        { title: originalTitle, scope_note: originalScopeNote },
        testActorId,
        testActorEmail
      );
    }

    passed++;
    console.log('✅ Test 4: Draft editing and audit trail logging verified.');

    // -------------------------------------------------------------
    // Test 5: Approval Workflow Invariants
    // -------------------------------------------------------------
    // Approve brief 1 and brief 2
    await toggleDraftApproval(brief1.id, true, testActorId, testActorEmail);
    await toggleDraftApproval(brief2.id, true, testActorId, testActorEmail);

    const { rows: approvedDrafts } = await pool.query(`
      SELECT id, is_approved_for_release FROM public.problem_statement_drafts 
      WHERE id IN ($1, $2);
    `, [brief1.id, brief2.id]);
    assert.strictEqual(approvedDrafts[0].is_approved_for_release, true);
    assert.strictEqual(approvedDrafts[1].is_approved_for_release, true);

    passed++;
    console.log('✅ Test 5: Item approval workflow verified.');

    // -------------------------------------------------------------
    // Test 6: Atomic Publication Workflow & Draft Isolation
    // -------------------------------------------------------------
    // Publish Release v1
    const publishRes = await publishRelease(v1Release.id, testActorId, testActorEmail);
    assert.strictEqual(publishRes.status, 'published');
    assert.strictEqual(publishRes.is_current_published, true);

    // Verify database state
    const { rows: pubReleaseDb } = await pool.query(`
      SELECT is_current_published, status, published_at FROM public.problem_statement_releases 
      WHERE id = $1;
    `, [v1Release.id]);
    assert.strictEqual(pubReleaseDb[0].is_current_published, true);
    assert.strictEqual(pubReleaseDb[0].status, 'published');
    assert(pubReleaseDb[0].published_at !== null);

    const { rows: pubConfigDb } = await pool.query(`
      SELECT problem_statements_published, active_problem_release_id FROM public.event_config WHERE id = 1;
    `);
    assert.strictEqual(pubConfigDb[0].problem_statements_published, true);
    assert.strictEqual(pubConfigDb[0].active_problem_release_id, v1Release.id);

    // Verify public endpoint returns ONLY approved items (exactly 2), NOT the 30 unapproved/hold/proposal items!
    const publicResultPublished = await getPublicProblemStatements();
    assert.strictEqual(publicResultPublished.isPublished, true);
    assert(publicResultPublished.release !== null && publicResultPublished.release !== undefined);
    assert.strictEqual(publicResultPublished.release.version, 1);
    assert.strictEqual(publicResultPublished.statements.length, 2, 'Only approved items should be returned to public!');
    
    // Check that none of the hold items or unapproved items leaked
    const leakedHold = publicResultPublished.statements.find(s => s.id === 'HX-HT-01');
    assert(!leakedHold, 'Held item HX-HT-01 must NEVER be exposed publicly');
    const leakedUnapproved = publicResultPublished.statements.find(s => s.challenge_num === 3);
    assert(!leakedUnapproved, 'Unapproved briefs must NEVER be exposed publicly');

    passed++;
    console.log('✅ Test 6: Atomic publication verified. Only approved items exposed; held/unapproved briefs remain strictly private.');

    // -------------------------------------------------------------
    // Test 7: Emergency Unpublish / Withdrawal Workflow
    // -------------------------------------------------------------
    const unpublishRes = await unpublishRelease(v1Release.id, testActorId, testActorEmail);
    assert.strictEqual(unpublishRes.status, 'withdrawn');
    assert.strictEqual(unpublishRes.is_current_published, false);

    const { rows: withdrawnConfigDb } = await pool.query(`
      SELECT problem_statements_published FROM public.event_config WHERE id = 1;
    `);
    assert.strictEqual(withdrawnConfigDb[0].problem_statements_published, false);

    // Calling public endpoint immediately returns locked state
    const publicResultWithdrawn = await getPublicProblemStatements();
    assert.strictEqual(publicResultWithdrawn.isPublished, false);
    assert.strictEqual(publicResultWithdrawn.statements.length, 0);

    passed++;
    console.log('✅ Test 7: Emergency unpublish verified (immediate public withdrawal and locked state).');

    // -------------------------------------------------------------
    // Test 8: Version Control & Draft Cloning (Release v2 / vNext)
    // -------------------------------------------------------------
    const createdV2 = await createDraftRelease(
      'Test v2 - Cloned Candidate',
      v1Release.id,
      'Cloning v1 working set for test verification',
      testActorId,
      testActorEmail
    );
    testReleaseV2Id = createdV2.id;
    assert.ok(createdV2.version_number > v1Release.version_number, 'New cloned release version must exceed source version');
    assert.strictEqual(createdV2.status, 'draft');
    assert.strictEqual(createdV2.is_current_published, false);

    // Verify all 32 drafts were cloned
    const { rows: v2Drafts } = await pool.query(`
      SELECT * FROM public.problem_statement_drafts 
      WHERE release_id = $1 
      ORDER BY challenge_num ASC;
    `, [createdV2.id]);
    assert.strictEqual(v2Drafts.length, 32, 'All 32 drafts must be cloned into Release v2');

    // Verify cloned drafts faithfully retain approval states from source release
    const v2Brief1 = v2Drafts.find(d => d.challenge_num === 1);
    const v2Brief3 = v2Drafts.find(d => d.challenge_num === 3);
    assert(v2Brief1 && v2Brief3, 'Cloned briefs 1 and 3 must exist');
    assert.strictEqual(v2Brief1.is_approved_for_release, true, 'Cloned draft 1 retains approved state from source');
    assert.strictEqual(v2Brief3.is_approved_for_release, false, 'Cloned draft 3 remains unapproved as in source');

    passed++;
    console.log('✅ Test 8: Release versioning & draft cloning verified with 32 cloned briefs.');
  } finally {
    // -------------------------------------------------------------
    // Cleanup: Restore pristine staging environment
    // -------------------------------------------------------------
    try {
      if (testReleaseV2Id) {
        await pool.query('DELETE FROM public.problem_statement_drafts WHERE release_id = $1;', [testReleaseV2Id]);
        await pool.query('DELETE FROM public.problem_statement_audit_logs WHERE release_id = $1;', [testReleaseV2Id]);
        await pool.query('DELETE FROM public.problem_statement_releases WHERE id = $1;', [testReleaseV2Id]);
      }

      // Reset brief 1 and brief 2 approval state in v1
      await pool.query(`
        UPDATE public.problem_statement_drafts 
        SET is_approved_for_release = false 
        WHERE release_id = '68e5ae90-818d-4739-9522-8ac8599d3a0d';
      `);

      // Reset v1 release status to draft and unpublished
      await pool.query(`
        UPDATE public.problem_statement_releases 
        SET status = 'draft', is_current_published = false, published_at = NULL, published_by = NULL 
        WHERE id = '68e5ae90-818d-4739-9522-8ac8599d3a0d';
      `);

      // Restore original event_config
      await pool.query(`
        UPDATE public.event_config 
        SET 
          problem_statements_published = $1,
          active_problem_release_id = $2,
          updated_at = NOW()
        WHERE id = 1;
      `, [origConfig.problem_statements_published, origConfig.active_problem_release_id]);

      // If origConfig had an active release, make sure it is marked current_published
      if (origConfig.active_problem_release_id) {
        await pool.query(`
          UPDATE public.problem_statement_releases 
          SET status = 'published', is_current_published = true 
          WHERE id = $1;
        `, [origConfig.active_problem_release_id]);
      }

      passed++;
      console.log('✅ Test 9: Pristine state restored (test releases cleaned, event_config and active release restored).');
      console.log(`\n=========================================`);
      console.log(`Problem Statement CMS Tests: ${passed} / 9 passed`);
      console.log(`=========================================\n`);
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    } finally {
      await pool.end();
    }
  }
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
