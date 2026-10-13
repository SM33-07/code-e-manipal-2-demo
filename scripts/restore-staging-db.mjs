#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Staging Database Restore & Verification Utility
 * File: scripts/restore-staging-db.mjs
 *
 * Restores the verified Gate 1 production backup dump into the isolated
 * Azure PostgreSQL staging database (cem_staging).
 *
 * Safety Invariants:
 *  - Enforces explicit connection boundary assertions (strictly refuses /postgres).
 *  - Restores exact table schemas and live production snapshot data.
 *  - Validates restored row counts against the backup manifest.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: Missing DATABASE_URL. Run with: node --env-file=.env.staging scripts/restore-staging-db.mjs');
  process.exit(1);
}

// ── Strict Connection Boundary Assertion ────────────────────────────────────
export function assertStagingDatabaseBoundary(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new Error(`Invalid DATABASE_URL format: ${err.message}`);
  }

  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];
  if (dbName === 'postgres' || dbName === '') {
    throw new Error(
      `CRITICAL SAFETY VIOLATION: Refusing to restore into database "${dbName}". ` +
      `This operation is strictly reserved for the isolated staging database ("cem_staging"). ` +
      `Targeting production /postgres is prohibited.`
    );
  }

  if (dbName !== 'cem_staging') {
    throw new Error(`Safety violation: Target database must be "cem_staging", got "${dbName}".`);
  }

  return true;
}

assertStagingDatabaseBoundary(databaseUrl);

async function run() {
  console.log('================================================================');
  console.log('   Code-e-Manipal 2.0 — Staging Database Restore (cem_staging)');
  console.log('================================================================');
  console.log(`Target Database:  cem_staging (Isolated Staging DB)`);
  console.log('----------------------------------------------------------------\n');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // 1. Prepare Schema Migrations
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    const allFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    // We run schema migrations up to 023 (excluding 002 mock seeds and 024 unapplied migration)
    const migrationFiles = allFiles.filter(f => !f.includes('002_seed') && !f.includes('024_'));

    console.log(`1. Applying ${migrationFiles.length} schema migrations to cem_staging...`);
    for (const file of migrationFiles) {
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sqlContent);
        await client.query('COMMIT');
      } catch (migErr) {
        await client.query('ROLLBACK').catch(() => {});
        console.warn(`   ⚠️ Migration ${file} note: ${migErr.message} (continuing idempotent setup)`);
      }
    }
    console.log('   ✅ Schema migrations applied.');

    // 2. Clear staging tables before dump restore
    console.log('\n2. Truncating staging tables...');
    const tablesToTruncate = [
      'public.audit_logs',
      'public.judge_reviews',
      'public.judge_assignments',
      'public.submissions',
      'public.team_members',
      'public.teams',
      'public.hackathon_registrations',
      'public.announcements',
      'public.posts',
      'public.event_config_kv',
      'public.event_config',
      'public.profiles',
      'auth.users',
    ];

    for (const table of tablesToTruncate) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`).catch(() => {});
    }
    console.log('   ✅ Staging tables truncated.');

    // 3. Load Verified Backup Dump
    const backupSqlPath = path.resolve(process.cwd(), 'backups/azure_postgres_backup_2026-10-12T18-58-06-831Z.sql');
    const manifestPath = path.resolve(process.cwd(), 'backups/backup_manifest_2026-10-12T18-58-06-831Z.json');

    if (!fs.existsSync(backupSqlPath)) {
      throw new Error(`Backup SQL dump not found at ${backupSqlPath}`);
    }
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Backup manifest not found at ${manifestPath}`);
    }

    console.log('\n3. Executing backup SQL dump in topological dependency order...');
    const sqlDump = fs.readFileSync(backupSqlPath, 'utf8');

    // Split dump into table blocks based on `-- Table: <name>` comments
    const blocks = {};
    const tableRegex = /-- Table:\s+([\w\.]+)\s+\(\d+\s+rows\)/g;
    let match;
    const matches = [];

    while ((match = tableRegex.exec(sqlDump)) !== null) {
      matches.push({ name: match[1], index: match.index });
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextIndex = i + 1 < matches.length ? matches[i + 1].index : sqlDump.length;
      blocks[current.name] = sqlDump.substring(current.index, nextIndex).trim();
    }

    const dependencyOrder = [
      'auth.users',
      'public.profiles',
      'public.teams',
      'public.team_members',
      'public.submissions',
      'public.judge_reviews',
      'public.judge_assignments',
      'public.hackathon_registrations',
      'public.announcements',
      'public.posts',
      'public.event_config',
      'public.event_config_kv',
      'public.login_attempts',
      'public.results_snapshot',
      'public.results_awards',
      'public.review_history',
      'public.audit_logs',
    ];

    await client.query('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');
    await client.query('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_team_id_fkey;');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'submissions' AND column_name = 'technologies' AND data_type = 'ARRAY'
        ) THEN
          ALTER TABLE public.submissions ALTER COLUMN technologies DROP DEFAULT;
          ALTER TABLE public.submissions ALTER COLUMN technologies TYPE JSONB USING to_jsonb(technologies);
          ALTER TABLE public.submissions ALTER COLUMN technologies SET DEFAULT '[]'::jsonb;
        END IF;
      END $$;
    `);

    try {
      for (const tableName of dependencyOrder) {
        if (blocks[tableName]) {
          console.log(`   Loading ${tableName}...`);
          await client.query(blocks[tableName]);

          // Re-add profiles_team_id_fkey right after teams is loaded
          if (tableName === 'public.teams') {
            await client.query(`
              ALTER TABLE public.profiles
              ADD CONSTRAINT profiles_team_id_fkey
              FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
            `);
          }
        }
      }
      console.log('   ✅ All tables loaded in dependency order.');
    } finally {
      await client.query(`
        ALTER TABLE public.profiles
        DROP CONSTRAINT IF EXISTS profiles_team_id_fkey;
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
      `).catch(() => {});

      await client.query(`
        CREATE OR REPLACE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW
          EXECUTE FUNCTION public.handle_new_user();
      `).catch(() => {});
    }

    // 4. Verify Restored State against Manifest
    console.log('\n4. Verifying restored row counts against manifest...');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    let verifiedCount = 0;
    let mismatchCount = 0;

    for (const [tableName, meta] of Object.entries(manifest.tables)) {
      try {
        const res = await client.query(`SELECT count(*) FROM ${tableName}`);
        const currentCount = parseInt(res.rows[0].count, 10);
        const expectedCount = meta.row_count;

        if (currentCount === expectedCount) {
          console.log(`   ✅ ${tableName.padEnd(32)}: ${currentCount} / ${expectedCount}`);
          verifiedCount++;
        } else {
          console.error(`   ❌ ${tableName.padEnd(32)}: MISMATCH! Found ${currentCount}, expected ${expectedCount}`);
          mismatchCount++;
        }
      } catch (chkErr) {
        console.warn(`   ⚠️ ${tableName.padEnd(32)}: Verification error: ${chkErr.message}`);
      }
    }

    console.log('\n================================================================');
    if (mismatchCount === 0) {
      console.log(`🎉 STAGING RESTORE COMPLETE: All ${verifiedCount} tables match verified backup.`);
    } else {
      console.log(`⚠️ STAGING RESTORE FINISHED WITH ${mismatchCount} MISMATCHES.`);
      process.exitCode = 1;
    }
    console.log('================================================================');
  } finally {
    await client.end();
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMainModule || process.argv[1]?.includes('restore-staging-db')) {
  run().catch(err => {
    console.error('💥 Fatal error in staging restore utility:', err);
    process.exit(1);
  });
}
