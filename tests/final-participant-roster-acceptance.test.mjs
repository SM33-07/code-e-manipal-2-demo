import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import xlsx from 'xlsx';
import path from 'path';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe('Code-e-Manipal 2.0 Final Participant Mapping & Team Rosters Acceptance', () => {

  let officialTeams;
  let participants;

  before(async () => {
    const officialTeamsPath = path.resolve('.credentials/Code_e_Manipal_Official_Team_Login_Details(2).xlsx');
    const participantsPath = path.resolve('.credentials/Code-e-Manipal_2.0_Round_2_Final_Perfectly_Mapped.xlsx');

    const wbTeams = xlsx.readFile(officialTeamsPath);
    officialTeams = xlsx.utils.sheet_to_json(wbTeams.Sheets[wbTeams.SheetNames[0]]);

    const wbParticipants = xlsx.readFile(participantsPath);
    participants = xlsx.utils.sheet_to_json(wbParticipants.Sheets[wbParticipants.SheetNames[0]]);
  });

  after(async () => {
    await pool.end();
  });

  test('1. Authoritative workbook counts: 86 official teams and 219 registration rows', () => {
    assert.equal(officialTeams.length, 86, 'Must contain exactly 86 official teams');
    assert.equal(participants.length, 219, 'Must contain exactly 219 registration rows');
  });

  test('2. Exactly 2 duplicate-email pairs deduplicated cleanly to 217 unique participants', () => {
    const emailOccurrences = new Map();
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const em = String(p['Email Id:'] || '').trim().toLowerCase();
      if (!emailOccurrences.has(em)) emailOccurrences.set(em, []);
      emailOccurrences.get(em).push(i);
    }

    const duplicates = [];
    for (const [em, idxs] of emailOccurrences.entries()) {
      if (idxs.length > 1) duplicates.push(em);
    }

    assert.equal(duplicates.length, 2, 'Must have exactly 2 duplicate email addresses');
    assert.ok(duplicates.includes('mishrapriyesh354@gmail.com'));
    assert.ok(duplicates.includes('apoorvmaurya789@gmail.com'));
    assert.equal(emailOccurrences.size, 217, 'Must have exactly 217 unique participant emails');
  });

  test('3. Exactly 4 unmatched participants under team "Room 118" cleanly isolated as exceptions', () => {
    const normalize = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const officialNames = new Set(officialTeams.map(t => normalize(t['Team Name (official file)'])));

    const unmatched = [];
    for (const p of participants) {
      const tName = normalize(p['Team Name:']);
      if (!officialNames.has(tName)) {
        unmatched.push(p);
      }
    }

    // Unmatched contains 4 rows from "Room 118"
    assert.equal(unmatched.length, 4, 'Must have exactly 4 unmatched rows from Room 118');
    unmatched.forEach(u => {
      assert.equal(normalize(u['Team Name:']), 'room 118');
    });
  });

  test('4. All 86 official teams (TEAM001-TEAM086) exist in database with preserved credentials & identifiers', async () => {
    const { rows } = await pool.query(`
      SELECT t.id, t.name, t.invite_code, p.identifier, p.login_id
      FROM public.teams t
      JOIN public.profiles p ON p.team_id = t.id AND p.role = 'participant'
      WHERE t.invite_code LIKE 'TEAM%'
      ORDER BY t.invite_code ASC
    `);

    assert.ok(rows.length >= 86, 'All 86 official teams must exist in database');
    for (let i = 1; i <= 86; i++) {
      const code = `TEAM${String(i).padStart(3, '0')}`;
      const row = rows.find(r => r.invite_code === code);
      assert.ok(row, `Team ${code} must exist in database`);
      assert.equal(row.login_id, code, `Login ID for ${code} must match`);
    }

    // Verify TEAM087 (Room 118) if present
    const t87 = rows.find(r => r.invite_code === 'TEAM087');
    if (t87) {
      assert.equal(t87.login_id, 'TEAM087');
      assert.equal(t87.identifier, 'TEAM-087');
    }
  });

  test('5. Each official team has exactly 1 leader record in team_members with is_verified = TRUE', async () => {
    const { rows } = await pool.query(`
      SELECT t.invite_code,
             COUNT(CASE WHEN tm.role = 'leader' THEN 1 END) AS leader_count,
             COUNT(CASE WHEN tm.role = 'leader' AND tm.is_verified = TRUE THEN 1 END) AS verified_leader_count
      FROM public.teams t
      JOIN public.team_members tm ON tm.team_id = t.id
      WHERE t.invite_code LIKE 'TEAM%'
      GROUP BY t.id, t.invite_code
    `);

    assert.ok(rows.length >= 86, 'All teams must have a leader record');
    for (const r of rows) {
      assert.equal(Number(r.leader_count), 1, `Team ${r.invite_code} must have exactly 1 leader`);
      assert.equal(Number(r.verified_leader_count), 1, `Team ${r.invite_code} leader must be verified`);
    }
  });

  test('6. Non-leader roster members are registered with is_verified = FALSE and have no individual Supabase Auth account', async () => {
    const { rows } = await pool.query(`
      SELECT tm.id, tm.name, tm.email, tm.user_id, tm.role, tm.is_verified, tm.college, tm.study_year
      FROM public.team_members tm
      WHERE tm.role = 'member'
    `);

    assert.ok(rows.length >= 141, 'Must have at least 141 non-leader roster members');
    for (const m of rows) {
      assert.equal(m.user_id, null, 'Roster member must not have an individual auth user_id');
      assert.equal(m.is_verified, false, 'Roster member must be marked Registered (is_verified = false)');
      assert.ok(m.name, 'Roster member must have a name');
      assert.ok(m.college, 'Roster member must have college recorded');
    }
  });

  test('7. Team capacity invariants: no team exceeds maximum capacity of 6 members', async () => {
    const { rows } = await pool.query(`
      SELECT t.invite_code, COUNT(tm.id)::int as count
      FROM public.teams t
      JOIN public.team_members tm ON tm.team_id = t.id
      GROUP BY t.id, t.invite_code
    `);

    for (const r of rows) {
      assert.ok(r.count >= 1 && r.count <= 6, `Team ${r.invite_code} size (${r.count}) must be between 1 and 6`);
    }
  });

  test('8. Full roster details returned by teamService queries (LEFT JOIN includes non-auth members)', async () => {
    // Pick a team with multiple members (e.g. TEAM001 has 3 members)
    const { rows: teamRows } = await pool.query(`
      SELECT t.id, t.invite_code, t.name,
             (SELECT json_agg(json_build_object(
               'id', tm.id,
               'name', COALESCE(tm.name, p.name),
               'email', COALESCE(tm.email, p.email),
               'role', tm.role,
               'is_verified', tm.is_verified,
               'college', tm.college,
               'study_year', tm.study_year
             ) ORDER BY (tm.role = 'leader') DESC, tm.joined_at ASC)
             FROM public.team_members tm
             LEFT JOIN public.profiles p ON p.id = tm.user_id
             WHERE tm.team_id = t.id) as members
      FROM public.teams t
      WHERE t.invite_code = 'TEAM001'
    `);

    const team = teamRows[0];
    assert.ok(team, 'TEAM001 must exist');
    assert.ok(Array.isArray(team.members), 'Members must be an array');
    assert.ok(team.members.length >= 2, 'TEAM001 must have multiple members in roster');
    assert.equal(team.members[0].role, 'leader', 'First member in array must be leader');
    assert.equal(team.members[0].is_verified, true, 'Leader must be verified');
    assert.equal(team.members[1].role, 'member', 'Second member must be member');
    assert.equal(team.members[1].is_verified, false, 'Member must not be labeled verified');
  });
});
