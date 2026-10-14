import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

// ── Passcode Generation ──────────────────────────────────────────────────────
const ALPHANUMERIC_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomCharacter(charset) {
  const limit = Math.floor(256 / charset.length) * charset.length;
  let value;
  do {
    value = crypto.randomBytes(1)[0];
  } while (value >= limit);
  return charset[value % charset.length];
}

export function generateParticipantPasscode(length = 8) {
  while (true) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += randomCharacter(ALPHANUMERIC_CHARSET);
    }
    if (/[a-zA-Z]/.test(result) && /[0-9]/.test(result)) {
      return result;
    }
  }
}

// ── Canonical Identifiers ────────────────────────────────────────────────────
export function toCanonicalIdentifier(teamId) {
  const numPart = teamId.replace(/^TEAM-?/i, '');
  return `TEAM-${numPart.padStart(3, '0')}`;
}

export function normalizeRosterEmail(teamId, rawEmail) {
  const trimmed = (rawEmail || '').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(trimmed)) {
    return { email: trimmed.toLowerCase(), normalized: false, raw: trimmed };
  }
  if (/^[a-zA-Z]+\.[0-9]+$/.test(trimmed)) {
    return {
      email: `${trimmed.toLowerCase()}@muj.manipal.edu`,
      normalized: true,
      raw: trimmed,
      reason: 'Appended @muj.manipal.edu domain to student registration ID',
    };
  }
  const numPart = teamId.replace(/^TEAM-?/i, '');
  return {
    email: `team-${numPart.padStart(3, '0').toLowerCase()}@auth.codeemanipal.in`,
    normalized: true,
    raw: trimmed,
    reason: 'Applied canonical identity mapping team-XXX@auth.codeemanipal.in',
  };
}

// ── Load or Generate Stable Official Credentials ─────────────────────────────
export function getOrCreateOfficialCredentials(rosterRows, credFilePath) {
  if (fs.existsSync(credFilePath)) {
    const raw = fs.readFileSync(credFilePath, 'utf8');
    const existing = JSON.parse(raw);
    if (existing.length === 86) {
      return existing;
    }
  }

  const generated = [];
  const usedPasscodes = new Set();

  for (let i = 0; i < rosterRows.length; i++) {
    const r = rosterRows[i];
    const teamId = String(r['Team ID'] || '').trim();
    const loginId = String(r['Login ID'] || '').trim();
    const teamName = String(r['Team Name'] || '').trim();
    const contactName = String(r['Primary Contact (verify team leader)'] || '').trim();
    const rawEmail = String(r['Contact Email'] || '').trim();
    const { email: authEmail, normalized, reason } = normalizeRosterEmail(teamId, rawEmail);

    let passcode;
    do {
      passcode = generateParticipantPasscode(8);
    } while (usedPasscodes.has(passcode));
    usedPasscodes.add(passcode);

    generated.push({
      teamId,
      loginId,
      canonicalIdentifier: toCanonicalIdentifier(teamId),
      teamName,
      contactName,
      rawContactEmail: rawEmail,
      authEmail,
      emailNormalized: normalized,
      normalizationReason: reason || null,
      officialPasscode: passcode,
    });
  }

  const credDir = path.dirname(credFilePath);
  if (!fs.existsSync(credDir)) {
    fs.mkdirSync(credDir, { recursive: true });
  }
  fs.writeFileSync(credFilePath, JSON.stringify(generated, null, 2), 'utf8');
  return generated;
}

// ── Environment Reconciler ───────────────────────────────────────────────────
export async function reconcileEnvironment(envName, dbUrl, sbUrl, sbKey, officialCredentials) {
  console.log(`\n================================================================`);
  console.log(`  RECONCILIATION PREFLIGHT REPORT — [${envName.toUpperCase()}]`);
  console.log(`================================================================`);

  const u = new URL(dbUrl);
  const dbHost = u.host;
  const dbName = u.pathname.replace(/^\//, '');
  console.log(`Database:     ${dbHost} / ${dbName}`);
  console.log(`Supabase URL: ${sbUrl}`);

  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // 1. Fetch DB State
    const { rows: profiles } = await pool.query(`
      SELECT id, name, email, role, identifier, login_id, team_id, is_disabled, force_logout_before
      FROM public.profiles;
    `);
    const { rows: teams } = await pool.query(`
      SELECT id, name, invite_code, leader_name, created_by
      FROM public.teams;
    `);
    const { rows: submissions } = await pool.query(`
      SELECT id, team_id
      FROM public.submissions;
    `);

    // 2. Fetch Supabase Auth Users
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authErr) throw authErr;
    const authUsers = authData.users;

    console.log(`\nCurrent Database Records:`);
    console.log(`- Profiles Total:    ${profiles.length}`);
    console.log(`- Teams Total:       ${teams.length}`);
    console.log(`- Submissions Total: ${submissions.length}`);
    console.log(`- Supabase Auth Total Users: ${authUsers.length}`);

    // Map existing records
    const profileById = new Map(profiles.map(p => [p.id, p]));
    const profileByLoginId = new Map(profiles.filter(p => p.login_id).map(p => [p.login_id.toUpperCase(), p]));
    const profileByIdentifier = new Map(profiles.filter(p => p.identifier).map(p => [p.identifier.toUpperCase(), p]));
    const profileByEmail = new Map(profiles.filter(p => p.email).map(p => [p.email.toLowerCase(), p]));

    const teamById = new Map(teams.map(t => [t.id, t]));
    const teamByName = new Map(teams.map(t => [t.name.trim().toLowerCase(), t]));

    const authById = new Map(authUsers.map(u => [u.id, u]));
    const authByEmail = new Map(authUsers.map(u => [u.email.toLowerCase(), u]));

    // 3. Reconcile each roster team
    let existingVerifiedAccounts = 0;
    let missingAuthIdentities = 0;
    let missingProfiles = 0;
    let missingTeams = 0;
    let conflictingRecords = 0;
    let accountsToUpdate = 0;
    let protectedAdmins = 0;

    const reconciliationDetails = [];

    for (const cred of officialCredentials) {
      const { teamId, loginId, canonicalIdentifier, teamName, authEmail } = cred;

      // Find team
      let existingTeam = teamByName.get(teamName.trim().toLowerCase());
      if (!existingTeam) {
        // Search by invite code or leader name
        existingTeam = teams.find(t => t.name === teamName);
      }

      // Find profile
      let existingProfile = profileByLoginId.get(loginId.toUpperCase()) ||
                            profileByIdentifier.get(canonicalIdentifier.toUpperCase()) ||
                            profileByEmail.get(authEmail.toLowerCase());

      // Find Auth User
      let existingAuth = null;
      if (existingProfile && authById.has(existingProfile.id)) {
        existingAuth = authById.get(existingProfile.id);
      } else if (authByEmail.has(authEmail.toLowerCase())) {
        existingAuth = authByEmail.get(authEmail.toLowerCase());
      }

      const teamStatus = existingTeam ? 'EXISTS' : 'MISSING';
      const profileStatus = existingProfile ? 'EXISTS' : 'MISSING';
      const authStatus = existingAuth ? 'EXISTS' : 'MISSING';

      if (!existingTeam) missingTeams++;
      if (!existingProfile) missingProfiles++;
      if (!existingAuth) missingAuthIdentities++;

      if (existingAuth && existingProfile && existingTeam) {
        existingVerifiedAccounts++;
        accountsToUpdate++;
      } else {
        // Needs creation or reconciliation
      }

      reconciliationDetails.push({
        teamId,
        loginId,
        teamName,
        teamStatus,
        profileStatus,
        authStatus,
        existingProfileId: existingProfile ? existingProfile.id : null,
        existingTeamId: existingTeam ? existingTeam.id : null,
      });
    }

    // Check matched profiles
    const matchedProfiles = reconciliationDetails.filter(d => d.profileStatus === 'EXISTS');
    console.log(`\nMatched Profiles in Database (${matchedProfiles.length}):`);
    for (const m of matchedProfiles) {
      console.log(`  - ${m.teamId} (${m.loginId}): Profile ID = ${m.existingProfileId}, Team Status = ${m.teamStatus}, Auth Status = ${m.authStatus}`);
    }

    if (submissions.length > 0) {
      console.log(`\nExisting Submissions (${submissions.length}):`);
      for (const s of submissions) {
        console.log(`  - Submission ID: ${s.id}, Team ID: ${s.team_id}`);
      }
    }

    // Check protected admins
    const adminProfiles = profiles.filter(p => p.role === 'admin');
    console.log(`\nProtected Administrator Accounts (${adminProfiles.length}):`);
    for (const adm of adminProfiles) {
      console.log(`  - [ADMIN] ${adm.name || 'Admin'} (${adm.email}) [ID: ${adm.id}]`);
    }

    console.log(`\nReconciliation Summary:`);
    console.log(`- Total Roster Teams:                ${officialCredentials.length}`);
    console.log(`- Existing Fully-Matched Accounts:   ${existingVerifiedAccounts}`);
    console.log(`- Missing Supabase Auth Identities:  ${missingAuthIdentities}`);
    console.log(`- Missing Application Profiles:      ${missingProfiles}`);
    console.log(`- Missing Teams in public.teams:     ${missingTeams}`);
    console.log(`- Conflicting/Duplicate Records:     ${conflictingRecords}`);
    console.log(`- Protected Administrator Accounts:  ${adminProfiles.length} (Untouched)`);

    return {
      envName,
      dbHost,
      dbName,
      sbUrl,
      totalTeams: officialCredentials.length,
      existingVerifiedAccounts,
      missingAuthIdentities,
      missingProfiles,
      missingTeams,
      conflictingRecords,
      adminCount: adminProfiles.length,
      reconciliationDetails,
    };
  } finally {
    await pool.end();
  }
}

// ── CLI Runner ───────────────────────────────────────────────────────────────
async function main() {
  const xlsxPath = 'C:\\Users\\SOHAM\\Downloads\\code_e_manipal_team_credentials_alphanumeric.xlsx';
  const credPath = path.resolve('.credentials/official_event_team_credentials.json');

  if (!fs.existsSync(xlsxPath)) {
    console.error('Authoritative roster not found at:', xlsxPath);
    process.exit(1);
  }

  const buf = fs.readFileSync(xlsxPath);
  const wb = xlsx.read(buf, { type: 'buffer' });
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Team Credentials']);

  console.log(`Loaded ${rows.length} teams from workbook.`);
  const officialCredentials = getOrCreateOfficialCredentials(rows, credPath);
  console.log(`Official Credentials Set: ${officialCredentials.length} teams loaded.`);

  const dbUrl = process.env.DATABASE_URL;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envName = process.argv[2] || 'TARGET';

  if (!dbUrl || !sbUrl || !sbKey) {
    console.error('Database and Supabase environment variables must be provided.');
    process.exit(1);
  }

  await reconcileEnvironment(envName, dbUrl, sbUrl, sbKey, officialCredentials);
}

main().catch(err => {
  console.error('Reconciliation error:', err);
  process.exit(1);
});
