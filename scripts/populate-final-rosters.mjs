import pg from 'pg';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

async function run() {
  console.log('=== Code-e-Manipal 2.0: Final Participant Roster Import ===\n');

  // Step 1: Apply Migration 029 (Schema extension for team roster)
  console.log('1. Applying Migration 029 (Team Roster Participants Extension)...');
  const migrationSql = fs.readFileSync(
    path.resolve('supabase/migrations/029_team_roster_participants.sql'),
    'utf-8'
  );
  await pool.query(migrationSql);
  console.log('   Migration 029 applied successfully.\n');

  // Step 2: Read Excel Workbooks
  console.log('2. Reading Authoritative Excel Workbooks...');
  const officialTeamsPath = path.resolve('.credentials/Code_e_Manipal_Official_Team_Login_Details(2).xlsx');
  const participantsPath = path.resolve('.credentials/Code-e-Manipal_2.0_Round_2_Final_Perfectly_Mapped.xlsx');

  const wbTeams = xlsx.readFile(officialTeamsPath);
  const officialTeams = xlsx.utils.sheet_to_json(wbTeams.Sheets[wbTeams.SheetNames[0]]);

  const wbParticipants = xlsx.readFile(participantsPath);
  const participants = xlsx.utils.sheet_to_json(wbParticipants.Sheets[wbParticipants.SheetNames[0]]);

  console.log(`   Loaded ${officialTeams.length} official teams (TEAM001-TEAM086).`);
  console.log(`   Loaded ${participants.length} participant registration rows.\n`);

  // Step 3: Build Canonical Team Maps
  const teamsByInviteCode = new Map();
  const teamsByNormalizedName = new Map();
  const teamsByLeaderEmail = new Map();

  for (const t of officialTeams) {
    const teamId = String(t['Team ID']).trim(); // e.g. TEAM001
    const rawName = String(t['Team Name (official file)']).trim();
    const normName = normalizeName(rawName);
    const contactEmail = normalizeName(t['Contact Email']);

    const teamRecord = {
      teamId,
      canonicalIdentifier: t['Canonical Identifier'],
      name: rawName,
      normName,
      contactName: String(t['Contact Name'] || '').trim(),
      contactEmail: String(t['Contact Email'] || '').trim(),
      authEmail: String(t['Auth Email'] || '').trim(),
      loginId: String(t['Login ID'] || '').trim(),
    };

    teamsByInviteCode.set(teamId, teamRecord);
    teamsByNormalizedName.set(normName, teamRecord);
    if (contactEmail) {
      teamsByLeaderEmail.set(contactEmail, teamRecord);
    }
  }

  // Step 4: Deduplicate Registrations
  console.log('3. Analyzing Participant Submissions & Duplicate Email Pairs...');
  const emailOccurrences = new Map();
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const email = normalizeName(p['Email Id:']);
    if (!emailOccurrences.has(email)) {
      emailOccurrences.set(email, []);
    }
    emailOccurrences.get(email).push({ index: i, row: p });
  }

  const deduplicatedParticipants = [];
  const skippedDuplicates = [];

  for (const [email, list] of emailOccurrences.entries()) {
    if (list.length === 1) {
      deduplicatedParticipants.push(list[0].row);
    } else {
      const first = list[0].row;
      const second = list[1].row;
      const sameName = normalizeName(first['Full Name:']) === normalizeName(second['Full Name:']);
      const sameTeam = normalizeName(first['Team Name:']) === normalizeName(second['Team Name:']);

      if (sameName && sameTeam) {
        console.log(`   Identified duplicate pair for "${first['Full Name:']}" (${email}) in team "${first['Team Name:']}".`);
        console.log(`     Skipping earlier submission (Row ${list[0].index + 2}), retaining latest submission (Row ${list[1].index + 2}).`);
        skippedDuplicates.push({
          skippedRowNumber: list[0].index + 2,
          retainedRowNumber: list[1].index + 2,
          name: first['Full Name:'],
          email,
          team: first['Team Name:'],
        });
        deduplicatedParticipants.push(list[1].row);
      } else {
        console.log(`   Conflicting duplicate email (${email}) with differing fields; retaining both rows.`);
        deduplicatedParticipants.push(list[0].row);
        deduplicatedParticipants.push(list[1].row);
      }
    }
  }

  console.log(`   Total registration rows: ${participants.length}`);
  console.log(`   Duplicate submissions skipped: ${skippedDuplicates.length}`);
  console.log(`   Validated unique participants: ${deduplicatedParticipants.length}\n`);

  // Step 5: Match Participants to Official Teams
  console.log('4. Matching Participants to Official Teams...');
  const matchedParticipants = [];
  const unmatchedParticipants = [];

  for (const p of deduplicatedParticipants) {
    const rawTeamName = String(p['Team Name:'] || '').trim();
    const normTeamName = normalizeName(rawTeamName);
    const pEmail = normalizeName(p['Email Id:']);
    const pName = String(p['Full Name:'] || '').trim();

    // Strategy A: Exact normalized name match
    let matchedTeam = teamsByNormalizedName.get(normTeamName);

    // Strategy B: Match via Leader Email
    if (!matchedTeam) {
      matchedTeam = teamsByLeaderEmail.get(pEmail);
    }

    // Strategy C: Alphanumeric match
    if (!matchedTeam) {
      const cleanP = normTeamName.replace(/[^a-z0-9]/g, '');
      for (const [tNorm, tRecord] of teamsByNormalizedName.entries()) {
        const cleanT = tNorm.replace(/[^a-z0-9]/g, '');
        if (cleanP && cleanP === cleanT) {
          matchedTeam = tRecord;
          break;
        }
      }
    }

    if (matchedTeam) {
      const isLeader = (
        normalizeName(matchedTeam.contactEmail) === pEmail ||
        normalizeName(matchedTeam.contactName) === normalizeName(pName)
      );

      matchedParticipants.push({
        fullName: pName,
        email: String(p['Email Id:'] || '').trim(),
        phone: String(p['Phone Number'] || '').trim(),
        college: String(p['College Name:'] || '').trim(),
        studyYear: String(p['Study Year:'] || '').trim(),
        submittedTeamName: rawTeamName,
        matchedTeamId: matchedTeam.teamId,
        matchedTeamName: matchedTeam.name,
        isLeader,
        timestamp: p['Timestamp'],
      });
    } else {
      unmatchedParticipants.push({
        fullName: pName,
        email: String(p['Email Id:'] || '').trim(),
        phone: String(p['Phone Number'] || '').trim(),
        college: String(p['College Name:'] || '').trim(),
        studyYear: String(p['Study Year:'] || '').trim(),
        teamName: rawTeamName,
      });
    }
  }

  console.log(`   Matched Participants: ${matchedParticipants.length}`);
  console.log(`   Unmatched Participants: ${unmatchedParticipants.length}`);
  if (unmatchedParticipants.length > 0) {
    console.log('   Unmatched List:');
    unmatchedParticipants.forEach((u, i) => {
      console.log(`     ${i + 1}. "${u.fullName}" (${u.email}) - Team: "${u.teamName}"`);
    });
  }
  console.log('');

  // Step 6: Query Existing Database Teams
  console.log('5. Reconciling Database Teams & Preserving Existing Accounts...');
  const { rows: dbTeams } = await pool.query('SELECT * FROM public.teams');
  const dbTeamByInviteCode = new Map();
  for (const t of dbTeams) {
    if (t.invite_code) {
      dbTeamByInviteCode.set(t.invite_code.toUpperCase(), t);
    }
  }
  console.log(`   Found ${dbTeams.length} teams in database.`);

  // Step 7: Backfill Existing Official Leaders in team_members
  console.log('6. Backfilling existing official leaders in public.team_members...');
  await pool.query(`
    UPDATE public.team_members tm
    SET name = COALESCE(tm.name, (SELECT p.name FROM public.profiles p WHERE p.id = tm.user_id), (SELECT t.leader_name FROM public.teams t WHERE t.id = tm.team_id), 'Official Team Leader'),
        email = COALESCE(tm.email, (SELECT p.email FROM public.profiles p WHERE p.id = tm.user_id)),
        is_verified = TRUE
    WHERE tm.role = 'leader'
  `);

  // Step 8: Apply Matched Participants to Database (Idempotent)
  console.log('7. Importing Matched Participants into public.team_members...');
  let updatedLeadersCount = 0;
  let insertedMembersCount = 0;

  for (const p of matchedParticipants) {
    const dbTeam = dbTeamByInviteCode.get(p.matchedTeamId.toUpperCase());
    if (!dbTeam) {
      console.warn(`   WARNING: Team ${p.matchedTeamId} not found in database!`);
      continue;
    }

    if (p.isLeader) {
      // Reconcile registration to the existing leader record
      const res = await pool.query(`
        UPDATE public.team_members
        SET name = $1,
            email = $2,
            phone = $3,
            college = $4,
            study_year = $5,
            is_verified = TRUE
        WHERE team_id = $6 AND role = 'leader'
        RETURNING id
      `, [p.fullName, p.email, p.phone, p.college, p.studyYear, dbTeam.id]);

      // Also ensure team's leader_name is up-to-date
      await pool.query(`
        UPDATE public.teams
        SET leader_name = $1
        WHERE id = $2
      `, [p.fullName, dbTeam.id]);

      updatedLeadersCount++;
    } else {
      // Insert or update non-leader roster member
      // Idempotent via UNIQUE (team_id, LOWER(TRIM(email)))
      await pool.query(`
        INSERT INTO public.team_members (
          team_id, user_id, role, name, email, phone, college, study_year, is_verified, joined_at
        ) VALUES ($1, NULL, 'member', $2, $3, $4, $5, $6, FALSE, NOW())
        ON CONFLICT (team_id, LOWER(TRIM(email))) WHERE email IS NOT NULL AND email <> ''
        DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          college = EXCLUDED.college,
          study_year = EXCLUDED.study_year
      `, [dbTeam.id, p.fullName, p.email, p.phone, p.college, p.studyYear]);

      insertedMembersCount++;
    }

    // Also populate hackathon_registrations for the leader idempotently
    if (p.isLeader) {
      await pool.query(`
        INSERT INTO public.hackathon_registrations (
          name, team_name, phone, email, round, status, updated_at
        ) VALUES ($1, $2, $3, $4, 2, 'approved', NOW())
        ON CONFLICT (team_name)
        DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          round = EXCLUDED.round,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [p.fullName, p.matchedTeamName, p.phone, p.email]);
    }
  }

  console.log(`   Updated ${updatedLeadersCount} existing official leader records.`);
  console.log(`   Upserted ${insertedMembersCount} roster member records.\n`);

  // Step 9: Verify Final Rosters & Team Membership Counts
  console.log('8. Verifying Final Team Roster Counts from Persisted Records...');
  const { rows: rosterCounts } = await pool.query(`
    SELECT t.invite_code, t.name AS team_name, t.leader_name,
           COUNT(tm.id)::int AS persisted_roster_count,
           COUNT(CASE WHEN tm.role = 'leader' THEN 1 END)::int AS leader_count,
           COUNT(CASE WHEN tm.role = 'member' THEN 1 END)::int AS member_count
    FROM public.teams t
    LEFT JOIN public.team_members tm ON tm.team_id = t.id
    GROUP BY t.id, t.invite_code, t.name, t.leader_name
    ORDER BY t.invite_code ASC
  `);

  let totalPersistedMembers = 0;
  let teamsWithPersistedRoster = 0;
  const countDistribution = {};

  for (const r of rosterCounts) {
    totalPersistedMembers += r.persisted_roster_count;
    if (r.persisted_roster_count > 0) teamsWithPersistedRoster++;
    countDistribution[r.persisted_roster_count] = (countDistribution[r.persisted_roster_count] || 0) + 1;
  }

  console.log(`   Total official teams in database: ${rosterCounts.length}`);
  console.log(`   Total persisted roster records: ${totalPersistedMembers}`);
  console.log('   Roster size distribution (members per team):', countDistribution);
  console.log('\n=== Roster Import Complete ===\n');

  await pool.end();

  return {
    totalRows: participants.length,
    skippedDuplicates: skippedDuplicates.length,
    uniqueParticipants: deduplicatedParticipants.length,
    matchedParticipants: matchedParticipants.length,
    unmatchedParticipants: unmatchedParticipants.length,
    unmatchedList: unmatchedParticipants,
    updatedLeadersCount,
    insertedMembersCount,
    totalPersistedMembers,
    rosterCounts,
  };
}

run().catch((err) => {
  console.error('Fatal error during roster import:', err);
  process.exit(1);
});
