#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Orphaned Supabase Auth Recovery Utility
 * File: scripts/recover-orphaned-auth.mjs
 *
 * Safe recovery and dead-letter queue processor for orphaned Supabase Auth
 * accounts where profile creation or compensation previously failed.
 *
 * Safety Invariants:
 *  - Verifies that Azure PostgreSQL public.profiles has NO record with the target ID.
 *  - Never deletes an Auth account that is actively bound to an authoritative profile.
 *  - Records resolution in data/reconciliation-dead-letter.json.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function checkEnv() {
  const missing = [];
  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('   Please run with: node --env-file=.env.local scripts/recover-orphaned-auth.mjs ...');
    process.exit(1);
  }

  // Connection boundary assertion
  const parsedDb = new URL(databaseUrl);
  const dbName = parsedDb.pathname.replace(/^\//, '').split('?')[0];
  const isProdDb = dbName === 'postgres';
  const isProdSupabase = (supabaseUrl || '').includes('ihnclawnbtkwvbfqwxfe');

  if (isProdDb && !isProdSupabase) {
    throw new Error('Boundary Mismatch: Target DB is production postgres, but Supabase URL is not production.');
  }
  if (!isProdDb && isProdSupabase) {
    throw new Error('Boundary Mismatch: Target DB is staging/custom, but Supabase URL is production.');
  }
}

async function recoverUser(authId, pgClient, supabase) {
  console.log(`\n🔍 Inspecting identity ${authId}...`);

  // 1. Verify that Azure PostgreSQL DOES NOT have a profile with this ID
  const profRes = await pgClient.query('SELECT id, email, role, identifier FROM public.profiles WHERE id = $1', [authId]);
  if (profRes.rows.length > 0) {
    const prof = profRes.rows[0];
    throw new Error(
      `ABORT: Cannot delete Auth user ${authId} because an authoritative Azure profile exists: ` +
      `Email: ${prof.email}, Role: ${prof.role}, Identifier: ${prof.identifier}`
    );
  }

  // 2. Fetch Supabase Auth user details
  const { data: authData, error: authGetErr } = await supabase.auth.admin.getUserById(authId);
  if (authGetErr || !authData.user) {
    console.log(`ℹ️ Auth user ${authId} does not exist in Supabase Auth (already removed or invalid).`);
    return { success: true, status: 'NOT_FOUND' };
  }

  console.log(`   Found orphaned Auth user: ${authData.user.email} (created at ${authData.user.created_at})`);

  // 3. Delete from Supabase Auth
  console.log(`   Deleting orphaned Auth user from Supabase Auth...`);
  const { error: delErr } = await supabase.auth.admin.deleteUser(authId);
  if (delErr) {
    throw new Error(`Failed to delete Supabase Auth user ${authId}: ${delErr.message}`);
  }

  // Also clean up Supabase cloud profiles table if present
  try {
    await supabase.from('profiles').delete().eq('id', authId);
  } catch (_) {}

  console.log(`   ✅ Successfully removed orphaned Auth user ${authId}.`);
  return { success: true, status: 'RECOVERED', email: authData.user.email };
}

async function main() {
  const args = process.argv.slice(2);
  const authIdIdx = args.indexOf('--auth-id');
  const authIdArg = authIdIdx !== -1 ? args[authIdIdx + 1] : null;
  const processQueue = args.includes('--process-queue');

  checkEnv();

  const deadLetterPath = path.resolve(process.cwd(), 'data/reconciliation-dead-letter.json');

  const pgClient = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (authIdArg) {
      await recoverUser(authIdArg, pgClient, supabase);
    } else if (processQueue) {
      if (!fs.existsSync(deadLetterPath)) {
        console.log('ℹ️ No dead-letter queue found (data/reconciliation-dead-letter.json does not exist).');
        return;
      }
      const records = JSON.parse(fs.readFileSync(deadLetterPath, 'utf8'));
      const pending = records.filter(r => r.status !== 'RESOLVED');
      console.log(`Found ${pending.length} pending items in dead-letter queue.`);

      for (const item of pending) {
        try {
          await recoverUser(item.authUserId, pgClient, supabase);
          item.status = 'RESOLVED';
          item.resolvedAt = new Date().toISOString();
        } catch (err) {
          console.error(`❌ Recovery failed for ${item.authUserId}: ${err.message}`);
        }
      }
      fs.writeFileSync(deadLetterPath, JSON.stringify(records, null, 2), 'utf8');
      console.log('✅ Dead-letter queue processing completed.');
    } else {
      console.log('Usage:');
      console.log('  node --env-file=.env.local scripts/recover-orphaned-auth.mjs --auth-id <UUID>');
      console.log('  node --env-file=.env.local scripts/recover-orphaned-auth.mjs --process-queue');
    }
  } finally {
    await pgClient.end();
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMainModule || process.argv[1]?.includes('recover-orphaned-auth')) {
  main().catch(err => {
    console.error('💥 Fatal error in recovery utility:', err);
    process.exit(1);
  });
}
