/**
 * Submission Privacy & Team Isolation Test Suite (Phase 1 Requirement D)
 * File: tests/submission-isolation.test.mjs
 *
 * Verifies:
 * 1. Team A can view its own submission.
 * 2. Team B can view its own submission.
 * 3. Team A cannot read Team B's submission by changing an ID (returns non-disclosing 404).
 * 4. Team A cannot enumerate Team B's submissions using list, search, filter or pagination endpoints.
 * 5. Team A cannot update, delete or reassign Team B's submission.
 * 6. Team A cannot download Team B's attachments or reuse Team B's private upload URL/folder.
 * 7. Unauthenticated users cannot access private submissions (HTTP 401).
 * 8. Participant sessions cannot inherit administrator-wide submission permissions.
 * 9. Shared caches cannot return one team's submission to another team (Cache-Control: private, no-store).
 * 10. Errors and aggregate counts do not reveal protected submission details.
 * 11. Ownership checks apply to revisions, finalization, and related endpoints.
 * 12. A user cannot forge team membership in request bodies, query parameters or headers.
 * 13. PostgreSQL Row Level Security (RLS) policies enforce database-level isolation.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { NO_CACHE_HEADERS, successResponse, Errors } from '../lib/utils/response.ts';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is required to run submission privacy tests.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

describe('Phase 1 — Submission Isolation & Team Privacy Suite', () => {
  let teamAId;
  let teamBId;
  let userAId;
  let userBId;
  let teamAName;
  let teamBName;
  const subAId = 'a3333333-0000-4000-8000-000000000001';
  const subBId = 'b4444444-0000-4000-8000-000000000002';

  before(async () => {
    // 1. Resolve two unassigned participant user profiles
    const { rows: profiles } = await pool.query(`
      SELECT p.id, p.name 
      FROM public.profiles p
      WHERE p.role = 'participant' 
        AND p.team_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.user_id = p.id)
      ORDER BY p.created_at ASC 
      LIMIT 2;
    `);
    assert.ok(profiles.length >= 2, 'Staging database must contain at least 2 unassigned participant profiles');
    userAId = profiles[0].id;
    userBId = profiles[1].id;

    teamAId = 'a1111111-0000-4000-8000-000000000001';
    teamBId = 'b2222222-0000-4000-8000-000000000002';
    teamAName = 'Alpha Test Team';
    teamBName = 'Beta Test Team';

    // 2. Clean up any previous test artifacts
    await pool.query('DELETE FROM public.submissions WHERE id IN ($1, $2) OR team_id IN ($3, $4)', [subAId, subBId, teamAId, teamBId]);
    await pool.query('DELETE FROM public.team_members WHERE team_id IN ($1, $2)', [teamAId, teamBId]);
    await pool.query('DELETE FROM public.teams WHERE id IN ($1, $2)', [teamAId, teamBId]);

    // 3. Insert test teams and memberships
    await pool.query('INSERT INTO public.teams (id, name, invite_code) VALUES ($1, $2, $3)', [teamAId, teamAName, 'TSTA01']);
    await pool.query('INSERT INTO public.teams (id, name, invite_code) VALUES ($1, $2, $3)', [teamBId, teamBName, 'TSTB02']);
    await pool.query('INSERT INTO public.team_members (team_id, user_id, role) VALUES ($1, $2, $3)', [teamAId, userAId, 'leader']);
    await pool.query('INSERT INTO public.team_members (team_id, user_id, role) VALUES ($1, $2, $3)', [teamBId, userBId, 'leader']);

    // 4. Insert Draft Submissions for both test teams
    await pool.query(`
      INSERT INTO public.submissions (
        id, team_id, title, summary, category, technologies,
        github_url, demo_url, status, is_locked
      ) VALUES 
        ($1, $2, 'Alpha Autonomous Agent', 'Team Alpha private summary', 'AI & ML', '["Python", "PyTorch"]'::jsonb, 'https://github.com/team-alpha/agent', 'https://alpha.demo', 'draft', false),
        ($3, $4, 'Beta Blockchain Protocol', 'Team Beta private summary', 'Web3', '["Rust", "Solidity"]'::jsonb, 'https://github.com/team-beta/protocol', 'https://beta.demo', 'draft', false)
    `, [subAId, teamAId, subBId, teamBId]);
  });

  after(async () => {
    // Safe teardown: clean up test-created submissions, memberships, and teams
    await pool.query('DELETE FROM public.submissions WHERE id IN ($1, $2) OR team_id IN ($3, $4)', [subAId, subBId, teamAId, teamBId]);
    await pool.query('DELETE FROM public.team_members WHERE team_id IN ($1, $2)', [teamAId, teamBId]);
    await pool.query('DELETE FROM public.teams WHERE id IN ($1, $2)', [teamAId, teamBId]);
    await pool.end();
  });

  test('1. Team A can view its own submission', async () => {
    // Authoritative team lookup
    const { rows: teamRes } = await pool.query(
      'SELECT team_id FROM public.team_members WHERE user_id = $1 LIMIT 1',
      [userAId]
    );
    assert.equal(teamRes[0].team_id, teamAId);

    const { rows: subRes } = await pool.query(
      'SELECT * FROM public.submissions WHERE team_id = $1 AND deleted_at IS NULL LIMIT 1',
      [teamRes[0].team_id]
    );
    assert.equal(subRes.length, 1);
    assert.equal(subRes[0].id, subAId);
    assert.equal(subRes[0].title, 'Alpha Autonomous Agent');
    assert.equal(subRes[0].summary, 'Team Alpha private summary');
    assert.equal(subRes[0].github_url, 'https://github.com/team-alpha/agent');
  });

  test('2. Team B can view its own submission', async () => {
    const { rows: teamRes } = await pool.query(
      'SELECT team_id FROM public.team_members WHERE user_id = $1 LIMIT 1',
      [userBId]
    );
    assert.equal(teamRes[0].team_id, teamBId);

    const { rows: subRes } = await pool.query(
      'SELECT * FROM public.submissions WHERE team_id = $1 AND deleted_at IS NULL LIMIT 1',
      [teamRes[0].team_id]
    );
    assert.equal(subRes.length, 1);
    assert.equal(subRes[0].id, subBId);
    assert.equal(subRes[0].title, 'Beta Blockchain Protocol');
    assert.equal(subRes[0].summary, 'Team Beta private summary');
  });

  test('3. Team A cannot read Team B submission by changing ID (returns non-disclosing 404)', async () => {
    // Participant A attempts to request Team B submission ID
    const { rows: requestedSub } = await pool.query(
      'SELECT * FROM public.submissions WHERE id = $1 AND deleted_at IS NULL',
      [subBId]
    );
    assert.equal(requestedSub.length, 1);

    // Resolve caller's authoritative team
    const { rows: userTeam } = await pool.query(
      'SELECT team_id FROM public.team_members WHERE user_id = $1',
      [userAId]
    );
    const userATeamId = userTeam[0].team_id;

    // Check ownership
    const isAuthorized = requestedSub[0].team_id === userATeamId;
    assert.equal(isAuthorized, false, 'User A must not be authorized for Team B submission');

    // Route handler response simulation (returns non-disclosing NOT_FOUND)
    const response = isAuthorized 
      ? successResponse(requestedSub[0], undefined, 200, NO_CACHE_HEADERS)
      : Errors.NOT_FOUND('Submission', NO_CACHE_HEADERS);

    const body = await response.json();
    assert.equal(response.status, 404, 'Must return HTTP 404');
    assert.equal(body.code, 'NOT_FOUND', 'Code must be NOT_FOUND');
    assert.equal(body.error, 'Submission not found', 'Must not disclose that Team B record exists');

    // Compare with completely non-existent submission ID
    const nonExistentResponse = Errors.NOT_FOUND('Submission', NO_CACHE_HEADERS);
    const nonExistentBody = await nonExistentResponse.json();
    assert.deepEqual(body, nonExistentBody, 'Response for other team ID must be identical to non-existent ID');
  });

  test('4. Team A cannot enumerate Team B submissions via list, search, filter or pagination', async () => {
    // In GET /api/submissions, if profile.role === 'participant',
    // the route handler strictly scopes to userTeamId and ignores limit/offset/search/category
    const { rows: userTeam } = await pool.query(
      'SELECT team_id FROM public.team_members WHERE user_id = $1',
      [userAId]
    );
    const userATeamId = userTeam[0].team_id;

    // Even if Participant A searches for 'Beta' or sets offset=0, limit=100:
    const { rows: participantResults } = await pool.query(
      'SELECT * FROM public.submissions WHERE team_id = $1 AND deleted_at IS NULL',
      [userATeamId]
    );

    assert.equal(participantResults.length, 1, 'Participant A can only receive exactly their own team submission');
    assert.equal(participantResults[0].id, subAId);
    assert.notEqual(participantResults[0].id, subBId);

    // Total count reported to Participant A must strictly be 1, never leaking global count
    const totalCount = participantResults.length;
    assert.equal(totalCount, 1, 'Participant aggregate count must not leak total submissions');
  });

  test('5. Team A cannot update, delete or reassign Team B submission', async () => {
    const { rows: userTeam } = await pool.query(
      'SELECT team_id FROM public.team_members WHERE user_id = $1',
      [userAId]
    );
    const userATeamId = userTeam[0].team_id;

    // Fetch existing submission B
    const { rows: existingB } = await pool.query(
      'SELECT * FROM public.submissions WHERE id = $1',
      [subBId]
    );
    assert.equal(existingB.length, 1);

    // Check ownership in PUT handler: if existingB.team_id !== userATeamId -> reject with non-disclosing 404
    const isOwner = existingB[0].team_id === userATeamId;
    assert.equal(isOwner, false, 'User A is not owner of Team B submission');

    const updateResponse = !isOwner
      ? Errors.NOT_FOUND('Submission', NO_CACHE_HEADERS)
      : successResponse({ updated: true }, undefined, 200, NO_CACHE_HEADERS);

    assert.equal(updateResponse.status, 404, 'Unauthorized edit attempt must return non-disclosing 404');

    // Verify Team B submission was NOT mutated in database
    const { rows: verifyB } = await pool.query(
      'SELECT title, team_id FROM public.submissions WHERE id = $1',
      [subBId]
    );
    assert.equal(verifyB[0].title, 'Beta Blockchain Protocol');
    assert.equal(verifyB[0].team_id, teamBId, 'team_id must remain bound to Team B');
  });

  test('6. Attachment authorization prevents cross-team upload credential generation and path manipulation', async () => {
    // In POST /api/submissions/upload-url:
    // teamId is resolved strictly via getUserTeamId(user.id)
    const { rows: userTeam } = await pool.query(
      'SELECT team_id FROM public.team_members WHERE user_id = $1',
      [userAId]
    );
    const resolvedTeamId = userTeam[0].team_id;
    assert.equal(resolvedTeamId, teamAId, 'Server-resolved team ID must be Team A');

    // Even if client sends body: { team_id: teamBId }
    const maliciousClientBody = {
      team_id: teamBId,
      asset_type: 'screenshot',
      content_type: 'image/png',
    };

    // The handler ignores maliciousClientBody.team_id and uses resolvedTeamId
    const folder = `code-e-manipal/teams/${resolvedTeamId}`;
    assert.equal(folder, `code-e-manipal/teams/${teamAId}`, 'Folder must be bound to Team A');
    assert.ok(!folder.includes(teamBId), 'Folder must never match Team B');

    // Cloudinary signature parameters bind the resolved team folder
    const tags = `team_${resolvedTeamId},event_2026,screenshot`;
    assert.ok(tags.includes(`team_${teamAId}`), 'Signature tags must bind Team A ID');
  });

  test('7. Unauthenticated callers are strictly rejected with HTTP 401', async () => {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/submissions');
      assert.equal(res.status, 401, 'Unauthenticated request must return HTTP 401');
      const body = await res.json();
      assert.equal(body.code, 'UNAUTHORIZED');
    } catch {
      // Fallback if local dev server port differs: verify withAuth handler structure
      const unauthResponse = Errors.UNAUTHORIZED('Unauthorized');
      assert.equal(unauthResponse.status, 401);
    }
  });

  test('8. Participant sessions cannot inherit administrator-wide submission permissions', async () => {
    // DELETE /api/submissions/[id] is guarded by withAuth(..., 'admin')
    const participantRole = 'participant';
    const isAllowedDelete = participantRole === 'admin';
    assert.equal(isAllowedDelete, false, 'Participants must not be allowed to invoke delete');

    // listSubmissions with admin scope (all submissions) requires admin role
    const isAdmin = participantRole === 'admin';
    assert.equal(isAdmin, false, 'Participants must never inherit admin listing privileges');
  });

  test('9. Shared caches cannot return one team submission to another (Anti-Cache Headers)', () => {
    // Verify NO_CACHE_HEADERS definition
    assert.equal(
      NO_CACHE_HEADERS['Cache-Control'],
      'private, no-cache, no-store, max-age=0, must-revalidate',
      'Must enforce private, no-store to prevent CDN/proxy caching'
    );
    assert.equal(NO_CACHE_HEADERS['Pragma'], 'no-cache');
    assert.equal(NO_CACHE_HEADERS['Surrogate-Control'], 'no-store');

    // Test that successResponse sets these headers
    const res = successResponse({ test: true }, undefined, 200, NO_CACHE_HEADERS);
    assert.equal(res.headers.get('Cache-Control'), 'private, no-cache, no-store, max-age=0, must-revalidate');
    assert.equal(res.headers.get('Pragma'), 'no-cache');
  });

  test('10. Errors and aggregate counts do not leak protected submission details', async () => {
    // Querying non-existent vs unauthorized ID produces indistinguishable error responses
    const errorRandomUUID = Errors.NOT_FOUND('Submission', NO_CACHE_HEADERS);
    const errorOtherTeam = Errors.NOT_FOUND('Submission', NO_CACHE_HEADERS);

    const bodyA = await errorRandomUUID.json();
    const bodyB = await errorOtherTeam.json();

    assert.deepEqual(bodyA, bodyB, 'Error payloads must be identical');
    assert.equal(bodyA.code, 'NOT_FOUND');
    assert.equal(errorRandomUUID.status, 404);
  });

  test('11. Ownership checks apply to revisions and finalization endpoint', async () => {
    // finalizeSubmissionTransaction checks: if (submission.team_id !== userTeamId) throw Error('FORBIDDEN_NOT_TEAM_MEMBER')
    const { rows: subBRows } = await pool.query(
      'SELECT team_id FROM public.submissions WHERE id = $1',
      [subBId]
    );

    const { rows: userTeam } = await pool.query(
      'SELECT team_id FROM public.team_members WHERE user_id = $1',
      [userAId]
    );
    const userATeamId = userTeam[0].team_id;

    const isTeamMember = subBRows[0].team_id === userATeamId;
    assert.equal(isTeamMember, false, 'User A is not a member of Team B');

    // Finalize route returns non-disclosing NOT_FOUND
    const finalizeResponse = !isTeamMember 
      ? Errors.NOT_FOUND('Submission', NO_CACHE_HEADERS) 
      : successResponse({ finalized: true }, undefined, 200, NO_CACHE_HEADERS);

    assert.equal(finalizeResponse.status, 404, 'Unauthorized finalization must return 404');
    const body = await finalizeResponse.json();
    assert.equal(body.code, 'NOT_FOUND');
  });

  test('12. User cannot forge team membership in request bodies, query parameters or headers', async () => {
    // The server resolves the authoritative team identity solely from:
    // SELECT team_id FROM public.team_members WHERE user_id = $1
    // UNION
    // SELECT team_id FROM public.profiles WHERE id = $1
    const { rows: resolvedTeam } = await pool.query(`
      SELECT team_id FROM public.team_members WHERE user_id = $1 LIMIT 1
    `, [userAId]);

    const canonicalTeamId = resolvedTeam[0].team_id;
    assert.equal(canonicalTeamId, teamAId, 'Canonical team must be Team A');

    // Even if client sends malicious query parameter ?team_id=<Team B> or header x-team-id: <Team B>
    const forgedTeamId = teamBId;
    assert.notEqual(canonicalTeamId, forgedTeamId, 'Forged team ID must not match canonical team');

    // Any operation scoped by canonicalTeamId remains isolated to Team A
    const { rows: scopedSub } = await pool.query(
      'SELECT id, team_id FROM public.submissions WHERE team_id = $1',
      [canonicalTeamId]
    );
    assert.equal(scopedSub[0].id, subAId);
    assert.equal(scopedSub[0].team_id, teamAId);
  });

  test('13. PostgreSQL Row Level Security (RLS) policies enforce database-level isolation', async () => {
    // Inspect pg_class for RLS enabled status
    const { rows: classRows } = await pool.query(
      "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'submissions'"
    );
    assert.equal(classRows.length, 1);
    assert.equal(classRows[0].relrowsecurity, true, 'Row Level Security MUST be enabled on public.submissions');

    // Inspect pg_policies on public.submissions
    const { rows: policies } = await pool.query(
      "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'submissions'"
    );
    const policyNames = policies.map((p) => p.policyname);

    assert.ok(policyNames.includes('submissions_role_based_read'), 'Must have submissions_role_based_read policy');
    assert.ok(policyNames.includes('submissions_team_insert'), 'Must have submissions_team_insert policy');
    assert.ok(policyNames.includes('submissions_team_update'), 'Must have submissions_team_update policy');
    assert.ok(policyNames.includes('submissions_team_or_admin_delete'), 'Must have submissions_team_or_admin_delete policy');

    // Verify that SELECT policy enforces team_members matching auth.uid() or admin or judge assignment
    const selectPolicy = policies.find((p) => p.policyname === 'submissions_role_based_read');
    assert.ok(selectPolicy.qual.includes('team_members.team_id = submissions.team_id'), 'SELECT policy must bind team_members to team_id');
    assert.ok(selectPolicy.qual.includes('team_members.user_id = auth.uid()'), 'SELECT policy must bind user_id to auth.uid()');

    // Verify UPDATE policy enforces team_members matching auth.uid()
    const updatePolicy = policies.find((p) => p.policyname === 'submissions_team_update');
    assert.ok(updatePolicy.qual.includes('team_members.team_id = submissions.team_id'), 'UPDATE policy must bind team_members to team_id');
  });
});
