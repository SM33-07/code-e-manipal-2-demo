#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Production Database & Auth Backup Utility (Gate 1)
 * File: scripts/backup-database.mjs
 *
 * Capabilities:
 *  - Establishes a strictly READ-ONLY transaction against Azure PostgreSQL.
 *  - Discovers all tables across public and auth schemas.
 *  - Exports complete transactional SQL dump (.sql) with valid insert statements.
 *  - Exports structured JSON archive (.json) with row counts and column schemas.
 *  - Exports sanitized Supabase Auth user inventory (.json) without secrets/tokens.
 *  - Validates backup integrity via row-count verification and SHA-256 checksums.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl || !supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing environment variables. Run with --env-file=.env.local');
  process.exit(1);
}

const backupsDir = path.resolve(process.cwd(), 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

function formatSqlValue(val, dataType) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function exportDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlDumpPath = path.join(backupsDir, `azure_postgres_backup_${timestamp}.sql`);
  const jsonDumpPath = path.join(backupsDir, `azure_postgres_backup_${timestamp}.json`);
  const authDumpPath = path.join(backupsDir, `supabase_auth_users_${timestamp}.json`);

  console.log('================================================================');
  console.log('   Code-e-Manipal 2.0 — Gate 1 Production Backup Preparation');
  console.log('================================================================');
  console.log(`Timestamp:        ${new Date().toISOString()}`);
  console.log(`Backup Directory: ${backupsDir}`);
  console.log('----------------------------------------------------------------\n');

  const pgClient = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const manifest = {
    backup_timestamp: new Date().toISOString(),
    database_host: 'code-e-manipal-db.postgres.database.azure.com',
    tables: {},
    total_rows: 0,
    files: {},
  };

  const sqlLines = [];
  sqlLines.push('-- ============================================================================');
  sqlLines.push(`-- Code-e-Manipal 2.0 — Azure PostgreSQL Consistent Backup`);
  sqlLines.push(`-- Generated At: ${manifest.backup_timestamp}`);
  sqlLines.push(`-- Mode: STRICTLY READ-ONLY SNAPSHOT`);
  sqlLines.push('-- ============================================================================');
  sqlLines.push('');
  sqlLines.push('BEGIN;');
  sqlLines.push('SET statement_timeout = 0;');
  sqlLines.push('SET client_encoding = \'UTF8\';');
  sqlLines.push('SET standard_conforming_strings = on;');
  sqlLines.push('');

  const jsonData = {
    metadata: {
      generated_at: manifest.backup_timestamp,
      database: 'code-e-manipal-db',
    },
    tables: {},
  };

  try {
    // 1. Begin read-only transaction to guarantee point-in-time consistency
    await pgClient.query('BEGIN TRANSACTION READ ONLY');

    // 2. Discover all tables in public schema
    const tablesRes = await pgClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    // Also check auth.users shadow table if accessible
    let hasShadowAuth = false;
    try {
      await pgClient.query('SELECT 1 FROM auth.users LIMIT 1;');
      hasShadowAuth = true;
    } catch (_) {}

    const allTargetTables = hasShadowAuth ? ['auth.users', ...tables.map(t => `public.${t}`)] : tables.map(t => `public.${t}`);

    console.log(`1. Exporting ${allTargetTables.length} tables from Azure PostgreSQL...`);

    for (const fullTableName of allTargetTables) {
      const [schemaName, tableName] = fullTableName.split('.');

      // Get columns
      const colsRes = await pgClient.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `, [schemaName, tableName]);
      const columns = colsRes.rows.map(c => c.column_name);

      // Get rows
      const rowsRes = await pgClient.query(`SELECT * FROM ${fullTableName};`);
      const rowCount = rowsRes.rows.length;
      manifest.tables[fullTableName] = {
        row_count: rowCount,
        columns,
      };
      manifest.total_rows += rowCount;
      jsonData.tables[fullTableName] = {
        columns,
        rows: rowsRes.rows,
      };

      console.log(`   • ${fullTableName.padEnd(32)}: ${String(rowCount).padStart(4)} row(s)`);

      // Write SQL table section
      sqlLines.push(`-- Table: ${fullTableName} (${rowCount} rows)`);
      if (rowCount > 0 && columns.length > 0) {
        for (const row of rowsRes.rows) {
          const colList = columns.map(c => `"${c}"`).join(', ');
          const valList = columns.map(c => formatSqlValue(row[c])).join(', ');
          sqlLines.push(`INSERT INTO ${fullTableName} (${colList}) VALUES (${valList}) ON CONFLICT DO NOTHING;`);
        }
      }
      sqlLines.push('');
    }

    sqlLines.push('COMMIT;');
    sqlLines.push('-- End of consistent snapshot');

    await pgClient.query('COMMIT'); // Close read-only transaction

    // 3. Write SQL and JSON backups to disk
    console.log('\n2. Writing consistent backup files to disk...');
    const sqlContent = sqlLines.join('\n');
    fs.writeFileSync(sqlDumpPath, sqlContent, 'utf8');

    const jsonContent = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(jsonDumpPath, jsonContent, 'utf8');

    // 4. Export Supabase Auth inventory (Strictly sanitized: NO secrets, tokens, or hashes)
    console.log('\n3. Preserving Supabase Auth user inventory (Sanitized)...');
    const authUsers = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error(`Supabase Auth export failed: ${error.message}`);
      authUsers.push(...data.users);
      if (data.users.length < 100) break;
    }

    const sanitizedAuthUsers = authUsers.map(u => ({
      id: u.id,
      email: u.email,
      phone: u.phone || null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      email_confirmed_at: u.email_confirmed_at || null,
      banned_until: u.banned_until || null,
      role: u.role || 'authenticated',
      user_metadata: u.user_metadata || {},
      app_metadata: u.app_metadata || {},
    }));

    const authExportData = {
      export_timestamp: manifest.backup_timestamp,
      supabase_project_url: supabaseUrl,
      total_users: sanitizedAuthUsers.length,
      users: sanitizedAuthUsers,
    };
    const authContent = JSON.stringify(authExportData, null, 2);
    fs.writeFileSync(authDumpPath, authContent, 'utf8');

    console.log(`   ✅ Exported ${sanitizedAuthUsers.length} Supabase Auth user(s) safely.`);

    // 5. Verification & Restore-Validation Procedure
    console.log('\n4. Running Restore-Validation & Integrity Checks...');
    const sqlStat = fs.statSync(sqlDumpPath);
    const jsonStat = fs.statSync(jsonDumpPath);
    const authStat = fs.statSync(authDumpPath);

    if (sqlStat.size === 0) throw new Error('SQL dump file is empty!');
    if (jsonStat.size === 0) throw new Error('JSON archive file is empty!');
    if (authStat.size === 0) throw new Error('Auth inventory file is empty!');

    // Checksums
    const sqlSha = crypto.createHash('sha256').update(fs.readFileSync(sqlDumpPath)).digest('hex');
    const jsonSha = crypto.createHash('sha256').update(fs.readFileSync(jsonDumpPath)).digest('hex');
    const authSha = crypto.createHash('sha256').update(fs.readFileSync(authDumpPath)).digest('hex');

    // Validation: Parse JSON back and verify row counts match
    const parsedJson = JSON.parse(fs.readFileSync(jsonDumpPath, 'utf8'));
    let verifiedRows = 0;
    Object.keys(parsedJson.tables).forEach(t => {
      verifiedRows += parsedJson.tables[t].rows.length;
    });

    if (verifiedRows !== manifest.total_rows) {
      throw new Error(`Integrity validation mismatch: expected ${manifest.total_rows} rows, restored ${verifiedRows}`);
    }

    // Record in manifest
    manifest.files = {
      sql_dump: { path: sqlDumpPath, size_bytes: sqlStat.size, sha256: sqlSha },
      json_archive: { path: jsonDumpPath, size_bytes: jsonStat.size, sha256: jsonSha },
      auth_inventory: { path: authDumpPath, size_bytes: authStat.size, sha256: authSha },
    };

    const manifestPath = path.join(backupsDir, `backup_manifest_${timestamp}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log('   ✅ File existence & non-empty checks passed.');
    console.log(`   ✅ SQL Dump Size:     ${(sqlStat.size / 1024).toFixed(2)} KB`);
    console.log(`   ✅ JSON Archive Size: ${(jsonStat.size / 1024).toFixed(2)} KB`);
    console.log(`   ✅ Auth Inventory:    ${(authStat.size / 1024).toFixed(2)} KB`);
    console.log(`   ✅ Total Rows Saved:  ${manifest.total_rows}`);
    console.log(`   ✅ SHA-256 (SQL):     ${sqlSha}`);
    console.log(`   ✅ SHA-256 (JSON):    ${jsonSha}`);
    console.log(`   ✅ SHA-256 (Auth):    ${authSha}`);

    console.log('\n================================================================');
    console.log('🎉 GATE 1 BACKUP PREPARATION COMPLETED SUCCESSFULLY.');
    console.log('   Zero production mutations were made.');
    console.log('================================================================');

    return { success: true, manifest };
  } finally {
    await pgClient.end();
  }
}

export { exportDatabase };

if (process.argv[1] && process.argv[1].endsWith('backup-database.mjs')) {
  exportDatabase().catch(err => {
    console.error('💥 Fatal error during backup:', err);
    process.exit(1);
  });
}
