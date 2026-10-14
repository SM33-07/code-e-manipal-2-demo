import xlsx from 'xlsx';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'ggmwribwynonpsvsmpyz';

async function main() {
  console.log('================================================================');
  console.log('  Code-e-Manipal 2.0 — Sync Exact Workbook Credentials (Staging)');
  console.log('================================================================\n');

  // 1. Verify Environment
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const dbUrl = process.env.DATABASE_URL || '';

  if (!sbUrl || !sbKey || !dbUrl) {
    console.error('❌ Missing environment variables. Please run with: node --env-file=.env.staging ...');
    process.exit(1);
  }

  const parsedSb = new URL(sbUrl);
  const parsedDb = new URL(dbUrl);

  console.log(`Checking target environment:`);
  console.log(`  Supabase Host: ${parsedSb.host}`);
  console.log(`  Postgres Host: ${parsedDb.host}`);
  console.log(`  Postgres DB:   ${parsedDb.pathname}`);

  if (!parsedSb.host.includes(STAGING_REF) || !parsedDb.pathname.includes('cem_staging')) {
    console.error(`❌ SAFETY ABORT: Target is NOT staging (${STAGING_REF} / cem_staging)!`);
    console.error(`   Host: ${parsedSb.host}, DB: ${parsedDb.pathname}`);
    process.exit(1);
  }
  console.log(`✅ Staging environment confirmed (${STAGING_REF} / cem_staging).\n`);

  // 2. Read and Validate Workbook
  const workbookFile = 'code_e_manipal_team_credentials_alphanumeric.xlsx';
  const wb = xlsx.readFile(workbookFile);
  const sheet = wb.Sheets['Team Credentials'];
  if (!sheet) {
    console.error(`❌ Sheet "Team Credentials" not found in ${workbookFile}`);
    process.exit(1);
  }

  const rows = xlsx.utils.sheet_to_json(sheet);
  console.log(`Loaded ${rows.length} rows from "${workbookFile}" (Sheet: Team Credentials)`);

  if (rows.length !== 86) {
    console.error(`❌ Expected exactly 86 rows in workbook, found ${rows.length}`);
    process.exit(1);
  }

  // Validate all 86 rows offline
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const pass = String(r['Temporary Passcode'] || '').trim();
    const loginId = String(r['Login ID'] || '').trim();
    const teamId = String(r['Team ID'] || '').trim();

    if (!loginId.startsWith('TEAM')) {
      throw new Error(`Row ${i + 1}: Invalid Login ID "${loginId}"`);
    }
    if (pass.length !== 8 || !/^[a-zA-Z0-9]{8}$/.test(pass) || !/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) {
      throw new Error(`Row ${i + 1} (${loginId}): Invalid passcode format. Must be 8 alphanumeric characters.`);
    }
  }
  console.log(`✅ All 86 rows validated: 8-character alphanumeric passcodes with letters and digits.\n`);

  // 3. Connect to Database and Supabase
  const pg = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Fetch all existing profiles
  const { rows: profiles } = await pg.query(
    'SELECT id, name, email, role, identifier, login_id, team_id, is_disabled FROM public.profiles'
  );
  const profileByLoginId = new Map(profiles.map(p => [p.login_id, p]));
  const profileByEmail = new Map(profiles.map(p => [(p.email || '').toLowerCase(), p]));

  // Fetch all existing teams
  const { rows: teams } = await pg.query('SELECT id, name, invite_code FROM public.teams');
  const teamByName = new Map(teams.map(t => [t.name.trim().toLowerCase(), t]));

  let updatedCount = 0;
  let createdCount = 0;
  let errors = [];

  console.log(`--- Synchronizing 86 Accounts with Exact Workbook Passcodes ---`);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const teamIdStr = String(r['Team ID'] || '').trim();
    const teamName = String(r['Team Name'] || '').trim();
    const loginId = String(r['Login ID'] || '').trim();
    const passcode = String(r['Temporary Passcode'] || '').trim();
    const rawEmail = String(r['Contact Email'] || '').trim().toLowerCase();
    const contactName = String(r['Primary Contact (verify team leader)'] || '').trim();

    const teamNum = parseInt(loginId.replace(/\D/g, ''), 10);
    const canonicalIdentifier = `TEAM-${String(teamNum).padStart(3, '0')}`;

    // Resolve profile
    let profile = profileByLoginId.get(loginId);
    if (!profile && rawEmail.includes('@')) {
      profile = profileByEmail.get(rawEmail);
    }

    try {
      if (profile) {
        // Account already exists — update password in Supabase Auth
        const { error: updateAuthErr } = await sb.auth.admin.updateUserById(profile.id, {
          password: passcode,
        });

        if (updateAuthErr) {
          throw new Error(`Failed to update password for ${loginId}: ${updateAuthErr.message}`);
        }

        // Ensure profile fields are correct in Azure PG
        await pg.query(
          `UPDATE public.profiles
           SET login_id = $1,
               identifier = $2,
               role = 'participant',
               is_disabled = false,
               force_logout_before = NULL,
               updated_at = NOW()
           WHERE id = $3`,
          [loginId, canonicalIdentifier, profile.id]
        );

        updatedCount++;
      } else {
        // Needs creation if somehow absent
        const normalizedEmail = rawEmail.includes('@')
          ? rawEmail
          : `team-${String(teamNum).padStart(3, '0')}@auth.codeemanipal.in`;

        const { data: newAuth, error: createAuthErr } = await sb.auth.admin.createUser({
          email: normalizedEmail,
          password: passcode,
          email_confirm: true,
          user_metadata: {
            role: 'participant',
            name: contactName || teamName,
            login_id: loginId,
            identifier: canonicalIdentifier,
          },
        });

        if (createAuthErr) {
          throw new Error(`Failed to create Auth user for ${loginId}: ${createAuthErr.message}`);
        }

        // Insert into public.profiles
        await pg.query(
          `INSERT INTO public.profiles (id, name, email, role, identifier, login_id, is_disabled)
           VALUES ($1, $2, $3, 'participant', $4, $5, false)
           ON CONFLICT (id) DO UPDATE
           SET login_id = EXCLUDED.login_id,
               identifier = EXCLUDED.identifier,
               role = 'participant',
               is_disabled = false,
               force_logout_before = NULL,
               updated_at = NOW()`,
          [newAuth.user.id, contactName || teamName, normalizedEmail, canonicalIdentifier, loginId]
        );

        createdCount++;
      }
    } catch (err) {
      errors.push({ loginId, error: err.message });
      console.error(`❌ Error on ${loginId}:`, err.message);
    }
  }

  console.log(`\nSynchronization Summary:`);
  console.log(`  Updated existing accounts: ${updatedCount}`);
  console.log(`  Newly created accounts:    ${createdCount}`);
  console.log(`  Errors encountered:        ${errors.length}`);

  if (errors.length > 0) {
    console.error(`❌ Provisioning encountered ${errors.length} errors.`);
    await pg.end();
    process.exit(1);
  }

  console.log(`✅ All 86 participant accounts successfully synchronized with workbook passcodes.\n`);

  await pg.end();
}

main().catch(console.error);
