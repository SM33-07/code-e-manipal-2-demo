#!/usr/bin/env node

/**
 * ============================================================================
 * Code-e-Manipal 2.0 — Admin & Judge Provisioning & Reconciliation Utility
 * File: scripts/provision-admin-judge.mjs
 *
 * Production-ready, idempotent provisioning and reconciliation workflow for
 * Admin and Judge accounts across Azure PostgreSQL (authoritative profiles/roles)
 * and Supabase Auth (authentication/passwords).
 *
 * Capabilities:
 *  - Pre-flight roster validation (rejects placeholders, validates RFC emails)
 *  - Canonical identifier allocation (ADMIN-XX, JUDGE-XX) with advisory locks
 *  - Idempotent identity reconciliation across Azure PG and Supabase Auth
 *  - Private password setup / invitation link generation (no plaintext passwords)
 *  - Strict confidentiality: Zero secrets, tokens, or raw setup URLs in logs
 *  - Transactional audit event recording in public.audit_logs
 *  - Dry-run validation (--dry-run) and guarded execution (--execute --confirm)
 *  - Non-destructive synthetic test verification (--test-synthetic)
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// ── Environment Verification ────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let siteUrl = 'http://localhost:3000';

export function resolveSiteUrl(options = {}) {
  const { sendInvitations = false, isProduction = false } = options;
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();

  if (isProduction || sendInvitations) {
    if (!configured) {
      throw new Error(
        'Production URL Configuration Error: NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL is not set. A verified production domain is mandatory for live execution or email invitations.'
      );
    }
    let parsed;
    try {
      parsed = new URL(configured);
    } catch (_) {
      throw new Error(`Production URL Configuration Error: Configured site URL "${configured}" is not a valid URL.`);
    }
    if (isProduction && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      throw new Error(
        `Production Security Violation: Cannot issue live invitation / setup links targeting localhost ("${configured}"). A deployed production domain is required.`
      );
    }
    return configured.replace(/\/+$/, '');
  }

  // Local development / dry-run fallback
  return (configured || 'http://localhost:3000').replace(/\/+$/, '');
}

export function assertConnectionBoundaries(options = {}) {
  const { isStaging = false, isProduction = false, dbUrl = databaseUrl, sbUrl = supabaseUrl } = options;
  if (!dbUrl) return;
  let parsedDb;
  try {
    parsedDb = new URL(dbUrl);
  } catch (err) {
    throw new Error(`Invalid DATABASE_URL: ${err.message}`);
  }

  const dbName = parsedDb.pathname.replace(/^\//, '').split('?')[0];
  const isProdDb = dbName === 'postgres' && parsedDb.hostname.includes('azure.com');
  const isStagingDb = dbName === 'cem_staging';

  const isProdSupabase = (sbUrl || '').includes('ihnclawnbtkwvbfqwxfe');
  const isStagingSupabase = (sbUrl || '').includes('ggmwribwynonpsvsmpyz');

  if (isStaging) {
    if (!isStagingDb) {
      throw new Error(
        `Staging Boundary Violation: Expected staging database "cem_staging", but got "${dbName}" (${parsedDb.hostname}). ` +
        `Execution halted to protect non-staging data.`
      );
    }
    if (isProdSupabase) {
      throw new Error(
        `Staging Boundary Violation: Cannot target production Supabase Auth project in staging mode. ` +
        `Expected staging Supabase project (ggmwribwynonpsvsmpyz), got production.`
      );
    }
  }

  if (isProduction) {
    if (isStagingDb || isStagingSupabase) {
      throw new Error(
        `Production Environment Error: Staging endpoints detected while running in production mode. ` +
        `Ensure .env.local or production credentials are active.`
      );
    }
  }

  return { isStaging: isStagingDb, isProduction: isProdDb, dbName };
}

function checkEnv(sendInvitations = false, isProduction = false, isStaging = false) {
  const missing = [];
  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('   Please run with: node --env-file=.env.local scripts/provision-admin-judge.mjs ...');
    process.exit(1);
  }

  assertConnectionBoundaries({ isStaging, isProduction });
  siteUrl = resolveSiteUrl({ sendInvitations, isProduction });
}

// ── Password Setup Invitation & Truthful Audit Logging ──────────────────────
/**
 * Issues password setup invitation / recovery with truthful delivery status & audit logging.
 *
 * Truthful State Distinctions:
 * 1. Link generation (admin.generateLink) -> Generates action link for custom delivery.
 * 2. Provider acceptance (resetPasswordForEmail) -> Supabase Auth accepted request for mailer transmission.
 * 3. Final delivery confirmation -> Requires SMTP delivery receipt/webhook (synchronously deliveryConfirmed: false).
 *
 * @param {object} supabase - Supabase client
 * @param {object} pgClient - PostgreSQL client (for audit logging)
 * @param {object} options
 * @param {string} options.email - Recipient email
 * @param {string} [options.role='admin'] - Account role ('admin' | 'judge')
 * @param {string} options.identifier - Canonical identifier ('ADMIN-02', etc.)
 * @param {string} options.userId - Canonical user UUID
 * @param {string} options.siteUrl - Canonical base site URL ('https://portal.codeemanipal.in')
 * @param {'supabase-mailer' | 'action-link'} [options.deliveryChannel='supabase-mailer']
 * @param {Function} [options.customLinkDispatcher] - Optional async hook (email, actionLink) => boolean
 * @returns {Promise<{ success: boolean, status: string, message: string, deliveryConfirmed: boolean }>}
 */
export async function issuePasswordSetupInvitation(supabase, pgClient, options = {}) {
  const {
    email,
    role = 'admin',
    identifier,
    userId,
    siteUrl,
    deliveryChannel = 'supabase-mailer',
    customLinkDispatcher = null,
  } = options;

  if (!email) throw new Error('Recipient email is required to issue password setup.');
  if (!siteUrl) throw new Error('Site URL is required to issue password setup.');

  const redirectTo = `${siteUrl.replace(/\/+$/, '')}/auth/setup-password`;

  if (deliveryChannel === 'supabase-mailer') {
    try {
      // Calls POST /recover on Supabase Auth (GoTrue), which transmits via configured mailer/SMTP
      const { data, error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetErr) throw resetErr;

      // Provider accepted: HTTP 200 confirms GoTrue generated token and accepted the email for delivery
      const auditDetails = {
        role,
        identifier,
        email,
        delivery_channel: 'supabase-mailer',
        redirect_url: redirectTo,
        status: 'PROVIDER_ACCEPTED',
        delivery_confirmed: false,
        note: 'Password recovery request accepted by Supabase Auth mailer for delivery. Mailbox delivery confirmation depends on upstream SMTP receipt.',
      };

      if (pgClient && userId) {
        await pgClient.query(
          `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
           VALUES ($1, $2, 'profiles', $3, $4)`,
          [
            userId,
            `${role.toUpperCase()}_PASSWORD_RECOVERY_REQUESTED`,
            userId,
            JSON.stringify(auditDetails),
          ]
        );
      }

      return {
        success: true,
        status: 'PROVIDER_ACCEPTED',
        deliveryConfirmed: false,
        message: 'Recovery request accepted by Supabase Auth mailer for delivery (pending inbox receipt)',
      };
    } catch (err) {
      const auditDetails = {
        role,
        identifier,
        email,
        delivery_channel: 'supabase-mailer',
        redirect_url: redirectTo,
        status: 'PROVIDER_FAILED',
        delivery_confirmed: false,
        error: err.message,
      };

      if (pgClient && userId) {
        await pgClient.query(
          `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
           VALUES ($1, $2, 'profiles', $3, $4)`,
          [
            userId,
            `${role.toUpperCase()}_PASSWORD_RECOVERY_FAILED`,
            userId,
            JSON.stringify(auditDetails),
          ]
        ).catch(() => { });
      }

      return {
        success: false,
        status: 'PROVIDER_FAILED',
        deliveryConfirmed: false,
        message: `Supabase mailer error: ${err.message}`,
      };
    }
  } else if (deliveryChannel === 'action-link') {
    try {
      // Calls POST /admin/generate_link on GoTrue
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });

      if (linkErr) throw linkErr;

      const actionLink = linkData?.properties?.action_link;
      if (!actionLink) {
        throw new Error('Supabase Auth did not return an action link in response payload.');
      }

      let customSuccess = false;
      let customErrMessage = null;
      if (typeof customLinkDispatcher === 'function') {
        try {
          customSuccess = await customLinkDispatcher(email, actionLink);
        } catch (cErr) {
          customErrMessage = cErr.message;
        }
      }

      const finalStatus = customSuccess
        ? 'DISPATCHED_TO_CUSTOM_MAILER'
        : customErrMessage
          ? 'CUSTOM_DISPATCH_FAILED'
          : 'LINK_GENERATED_NO_DELIVERY_HANDLER';

      const auditDetails = {
        role,
        identifier,
        email,
        delivery_channel: 'action-link',
        redirect_url: redirectTo,
        status: finalStatus,
        delivery_confirmed: false,
        note: customSuccess
          ? 'Action link securely passed to external email dispatcher.'
          : 'Action link generated via Admin API. No email was sent by Supabase Auth; delivery requires connected dispatcher.',
      };

      if (customErrMessage) {
        auditDetails.error = customErrMessage;
      }

      if (pgClient && userId) {
        await pgClient.query(
          `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
           VALUES ($1, $2, 'profiles', $3, $4)`,
          [
            userId,
            `${role.toUpperCase()}_SETUP_LINK_GENERATED`,
            userId,
            JSON.stringify(auditDetails),
          ]
        );
      }

      return {
        success: customSuccess || !customLinkDispatcher,
        status: finalStatus,
        deliveryConfirmed: false,
        message: customSuccess
          ? 'Setup link generated and dispatched to custom mail provider'
          : 'Setup link generated via Admin API (not emailed; delivery requires custom dispatcher)',
      };
    } catch (err) {
      const auditDetails = {
        role,
        identifier,
        email,
        delivery_channel: 'action-link',
        redirect_url: redirectTo,
        status: 'LINK_GENERATION_FAILED',
        delivery_confirmed: false,
        error: err.message,
      };

      if (pgClient && userId) {
        await pgClient.query(
          `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
           VALUES ($1, $2, 'profiles', $3, $4)`,
          [
            userId,
            `${role.toUpperCase()}_SETUP_LINK_FAILED`,
            userId,
            JSON.stringify(auditDetails),
          ]
        ).catch(() => { });
      }

      return {
        success: false,
        status: 'LINK_GENERATION_FAILED',
        deliveryConfirmed: false,
        message: `Action link generation error: ${err.message}`,
      };
    }
  } else {
    throw new Error(`Unsupported invitation delivery channel: ${deliveryChannel}`);
  }
}

// ── Dead Letter Recording for Failed Cleanups ──────────────────────────────
export function recordDeadLetter(entry) {
  const deadLetterPath = path.resolve(process.cwd(), 'data/reconciliation-dead-letter.json');
  let records = [];
  try {
    if (fs.existsSync(deadLetterPath)) {
      records = JSON.parse(fs.readFileSync(deadLetterPath, 'utf8'));
    }
  } catch (_) {
    records = [];
  }
  records.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  const dir = path.dirname(deadLetterPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(deadLetterPath, JSON.stringify(records, null, 2), 'utf8');
}

// ── Roster & Placeholder Validation ─────────────────────────────────────────
const PLACEHOLDER_PATTERN = /(PLACEHOLDER|JUDGE_NAME|JUDGE_EMAIL|SAMPLE_USER|YOUR_NAME|YOUR_EMAIL)/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRoster(records) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(records) || records.length === 0) {
    errors.push('Roster must be a non-empty array of account objects.');
    return { errors, warnings, validRecords: [] };
  }

  const seenEmails = new Set();
  const seenLoginIds = new Set();
  const seenIdentifiers = new Set();
  const validRecords = [];

  records.forEach((rec, index) => {
    const idx = index + 1;
    const name = (rec.name || '').trim();
    const email = (rec.email || '').trim().toLowerCase();
    const role = (rec.role || '').trim().toLowerCase();
    const proposedLoginId = (rec.proposed_login_id || rec.login_id || '').trim().toLowerCase();
    const explicitIdentifier = (rec.target_identifier || rec.identifier || '').trim().toUpperCase();

    // 1. Placeholder detection
    if (PLACEHOLDER_PATTERN.test(name)) {
      errors.push(`Record ${idx}: Name "${name}" contains placeholder text. Replace with verified details.`);
    }
    if (PLACEHOLDER_PATTERN.test(email)) {
      errors.push(`Record ${idx}: Email "${email}" contains placeholder text. Replace with verified details.`);
    }

    // 2. Field existence
    if (!name) errors.push(`Record ${idx}: Name is required.`);
    if (!email) errors.push(`Record ${idx}: Email is required.`);
    if (!role) {
      errors.push(`Record ${idx}: Role is required.`);
    } else if (role !== 'admin' && role !== 'judge') {
      errors.push(`Record ${idx}: Role "${role}" is invalid. Allowed roles: "admin", "judge".`);
    }

    // 3. Format validation
    if (email && !EMAIL_REGEX.test(email)) {
      errors.push(`Record ${idx}: Email "${email}" is not a valid email address.`);
    }

    if (explicitIdentifier) {
      const expectedPrefix = role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'JUDGE';
      const idPattern = new RegExp(`^${expectedPrefix}-\\d{2,}$`);
      if (!idPattern.test(explicitIdentifier)) {
        errors.push(`Record ${idx}: Explicit target identifier "${explicitIdentifier}" must match pattern ${expectedPrefix}-XX.`);
      }
      if (seenIdentifiers.has(explicitIdentifier)) {
        errors.push(`Record ${idx}: Duplicate explicit target identifier "${explicitIdentifier}" in roster.`);
      }
      seenIdentifiers.add(explicitIdentifier);
    }

    // 4. Batch uniqueness
    if (email) {
      if (seenEmails.has(email)) {
        errors.push(`Record ${idx}: Duplicate email "${email}" in roster.`);
      }
      seenEmails.add(email);
    }

    if (proposedLoginId) {
      if (seenLoginIds.has(proposedLoginId)) {
        errors.push(`Record ${idx}: Duplicate proposed login ID "${proposedLoginId}" in roster.`);
      }
      seenLoginIds.add(proposedLoginId);
    }

    validRecords.push({
      name,
      email,
      role,
      proposedLoginId: proposedLoginId || null,
      explicitIdentifier: explicitIdentifier || null,
      raw: rec,
    });
  });

  return { errors, warnings, validRecords };
}

// ── Canonical Identifier Allocator ──────────────────────────────────────────
export function allocateNextIdentifier(role, existingIdentifiers) {
  const prefix = role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'JUDGE';
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');

  let maxNum = 0;
  for (const id of existingIdentifiers) {
    const match = (id || '').match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}-${String(nextNum).padStart(2, '0')}`;
}

export function normalizeLoginId(name, role, existingLoginIds) {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  let base = sanitized.length > 0 ? sanitized : `${role}user`;

  if (!existingLoginIds.has(base)) {
    return base;
  }

  let counter = 2;
  while (existingLoginIds.has(`${base}${counter}`)) {
    counter++;
  }
  return `${base}${counter}`;
}

// ── Database System State Collection ────────────────────────────────────────
async function fetchSystemState(pgClient, supabase) {
  const profilesRes = await pgClient.query(`
    SELECT id, identifier, name, email, role, login_id, team_id, is_disabled
    FROM public.profiles;
  `);

  const authUsers = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Supabase Auth listUsers failed: ${error.message}`);
    authUsers.push(...data.users);
    if (data.users.length < 100) break;
  }

  return {
    profiles: profilesRes.rows,
    authUsers,
  };
}

// ── Reconciliation Analysis ─────────────────────────────────────────────────
function analyzeReconciliation(record, systemState, allocatedIdentifiers, allocatedLogins) {
  const email = record.email.toLowerCase();
  const existingProfile = systemState.profiles.find(p => (p.email || '').toLowerCase() === email);
  const existingAuth = systemState.authUsers.find(u => (u.email || '').toLowerCase() === email);

  // Collect all known identifiers & logins to prevent collision
  const allIdentifiers = new Set([
    ...systemState.profiles.map(p => p.identifier).filter(Boolean),
    ...allocatedIdentifiers,
  ]);
  const allLogins = new Set([
    ...systemState.profiles.map(p => p.login_id).filter(Boolean),
    ...allocatedLogins,
  ]);

  let targetIdentifier = '';
  let targetLoginId = '';
  let status = 'PLAN_CREATE';
  const actions = [];

  // Determine Identifier & Login ID
  if (record.explicitIdentifier) {
    targetIdentifier = record.explicitIdentifier;
    // Preflight collision assertion: verify no other user possesses this identifier
    const existingHolder = systemState.profiles.find(p => (p.identifier || '').toUpperCase() === targetIdentifier);
    if (existingHolder && (existingHolder.email || '').toLowerCase() !== email) {
      throw new Error(
        `Preflight Collision: Target identifier "${targetIdentifier}" is already occupied in Azure PG by ${existingHolder.email} (${existingHolder.name}, role: ${existingHolder.role}).`
      );
    }
    allocatedIdentifiers.add(targetIdentifier);

    if (record.proposedLoginId) {
      const existingLoginHolder = systemState.profiles.find(p => (p.login_id || '').toLowerCase() === record.proposedLoginId);
      if (!existingLoginHolder || (existingLoginHolder.email || '').toLowerCase() === email) {
        targetLoginId = record.proposedLoginId;
      } else {
        targetLoginId = normalizeLoginId(record.name, record.role, allLogins);
      }
    } else {
      targetLoginId = normalizeLoginId(record.name, record.role, allLogins);
    }
    allocatedLogins.add(targetLoginId);
  } else if (existingProfile && existingProfile.role === record.role && existingProfile.identifier) {
    targetIdentifier = existingProfile.identifier;
    targetLoginId = existingProfile.login_id || record.proposedLoginId || normalizeLoginId(record.name, record.role, allLogins);
  } else {
    targetIdentifier = allocateNextIdentifier(record.role, allIdentifiers);
    allocatedIdentifiers.add(targetIdentifier);

    if (record.proposedLoginId && !allLogins.has(record.proposedLoginId)) {
      targetLoginId = record.proposedLoginId;
    } else {
      targetLoginId = normalizeLoginId(record.name, record.role, allLogins);
    }
    allocatedLogins.add(targetLoginId);
  }

  // Determine identity situation
  if (existingProfile && existingAuth) {
    if (existingProfile.role === record.role) {
      status = 'ALREADY_PROVISIONED';
      actions.push('Account and profile already exist with target role.');
      if (existingProfile.id !== existingAuth.id) {
        status = 'RECONCILIATION_ID_MISMATCH';
        actions.push(`WARNING: Profile ID (${existingProfile.id}) differs from Auth ID (${existingAuth.id}). Manual sync required.`);
      }
    } else {
      status = 'RECONCILE_ROLE_PROMOTION';
      actions.push(`Promote profile role from "${existingProfile.role}" to "${record.role}".`);
      actions.push(`Reassign identifier from "${existingProfile.identifier || 'none'}" to "${targetIdentifier}".`);
      actions.push(`Set login_id to "${targetLoginId}".`);
      if (existingProfile.team_id) {
        actions.push(`Disassociate from team ID ${existingProfile.team_id} (Admins/Judges cannot have team associations).`);
      }
      actions.push(`Sync Supabase Auth user metadata role to "${record.role}".`);
    }
  } else if (existingProfile && !existingAuth) {
    status = 'RECONCILE_LINK_AUTH_PROFILE';
    actions.push(`Existing Azure placeholder profile found with ID ${existingProfile.id} (role: ${existingProfile.role}).`);
    actions.push(`Create canonical Supabase Auth identity via Admin API (generates new canonical Auth UUID).`);
    actions.push(`Safely replace unlinked placeholder profile and shadow auth.users row with new Auth UUID (inbound FKs verified = 0).`);
    if (existingProfile.role !== record.role) {
      actions.push(`Promote profile role from "${existingProfile.role}" to "${record.role}".`);
      actions.push(`Reassign identifier from "${existingProfile.identifier || 'none'}" to "${targetIdentifier}".`);
    }
    actions.push(`Set login_id to "${targetLoginId}".`);
  } else if (!existingProfile && existingAuth) {
    status = 'RECONCILE_CREATE_PROFILE';
    actions.push(`Existing Supabase Auth user found with ID ${existingAuth.id}.`);
    actions.push(`Create missing Azure PostgreSQL profile linked to Auth ID ${existingAuth.id}.`);
    actions.push(`Assign canonical identifier "${targetIdentifier}" and login_id "${targetLoginId}".`);
  } else {
    status = 'PLAN_PROVISION_NEW';
    actions.push(`Create new Supabase Auth user with confirmed email.`);
    actions.push(`Create authoritative Azure PostgreSQL profile (role: "${record.role}", identifier: "${targetIdentifier}", login_id: "${targetLoginId}").`);
  }

  return {
    record,
    status,
    targetIdentifier,
    targetLoginId,
    existingProfile,
    existingAuth,
    actions,
  };
}

// ── Synthetic End-to-End Verification ───────────────────────────────────────
async function runSyntheticTest(pgClient, supabase) {
  console.log('\n🧪 Running synthetic non-destructive test...');
  const testId = crypto.randomUUID();
  const testEmail = `synthetic-admin-${Date.now()}@learnit-muj.internal`;
  const testName = 'Synthetic Test Admin';
  const testRole = 'admin';
  const testLogin = `synthadmin${Date.now().toString().slice(-4)}`;

  let authUserId = null;

  try {
    console.log(`1. Creating synthetic Supabase Auth identity (${testEmail})...`);
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
      user_metadata: { name: testName, role: testRole, identifier: 'ADMIN-99' },
    });
    if (authErr || !authData.user) {
      throw new Error(`Failed to create synthetic Auth user: ${authErr?.message}`);
    }
    authUserId = authData.user.id;
    console.log(`   ✅ Supabase Auth created (UUID: ${authUserId})`);

    console.log(`2. Generating password setup link...`);
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: testEmail,
      options: { redirectTo: `${siteUrl}/auth/setup-password` },
    });
    if (linkErr) {
      throw new Error(`Failed to generate password setup link: ${linkErr.message}`);
    }
    console.log(`   ✅ Password setup link generated successfully (confidential: URL not logged)`);

    console.log(`3. Executing Azure PostgreSQL transaction...`);
    await pgClient.query('BEGIN');

    // Shadow in auth.users
    await pgClient.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [authUserId, testEmail, JSON.stringify({ name: testName, role: testRole, identifier: 'ADMIN-99' })]
    );

    // Profile upsert
    await pgClient.query(
      `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, login_id, team_id)
       VALUES ($1, $2, $3, '', $4, 'ADMIN-99', $5, NULL)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         identifier = EXCLUDED.identifier,
         login_id = EXCLUDED.login_id,
         team_id = NULL,
         updated_at = NOW()`,
      [authUserId, testName, testEmail, testRole, testLogin]
    );

    // Audit log
    await pgClient.query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, 'SYNTHETIC_TEST_ADMIN_PROVISIONED', 'profiles', $2, $3)`,
      [authUserId, authUserId, JSON.stringify({ role: testRole, identifier: 'ADMIN-99', login_id: testLogin })]
    );

    await pgClient.query('COMMIT');
    console.log(`   ✅ Database transaction committed.`);

    // Verification check
    const check = await pgClient.query(`SELECT * FROM public.profiles WHERE id = $1`, [authUserId]);
    if (check.rows.length === 0 || check.rows[0].role !== 'admin') {
      throw new Error('Verification failed: Profile row not found or role mismatch');
    }
    console.log(`   ✅ Verification check passed: Authoritative profile exists with role "admin".`);

    return { success: true };
  } catch (err) {
    await pgClient.query('ROLLBACK').catch(() => { });
    console.error(`   ❌ Synthetic test failed: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    console.log(`4. Tearing down synthetic test records...`);
    if (authUserId) {
      await pgClient.query(`DELETE FROM public.audit_logs WHERE user_id = $1`, [authUserId]).catch(() => { });
      await pgClient.query(`DELETE FROM public.profiles WHERE id = $1`, [authUserId]).catch(() => { });
      await pgClient.query(`DELETE FROM auth.users WHERE id = $1`, [authUserId]).catch(() => { });
      await supabase.auth.admin.deleteUser(authUserId).catch(() => { });
      console.log(`   ✅ Synthetic cleanup completed successfully.`);
    }
  }
}

async function executeProvisioning(plans, pgClient, supabase, options = {}) {
  const { sendInvitations = false, inviteChannel = 'supabase-mailer' } =
    typeof options === 'boolean' ? { sendInvitations: options } : options;

  console.log('\n🚀 Starting execution...');
  const results = [];

  for (const plan of plans) {
    const { record, status, targetIdentifier, targetLoginId, existingProfile, existingAuth } = plan;
    const email = record.email.toLowerCase();

    console.log(`\n▶ Processing [${record.role.toUpperCase()}] ${record.name} (${email})...`);

    if (status === 'ALREADY_PROVISIONED') {
      console.log(`   ℹ️ Already fully provisioned. No database modifications needed.`);

      let inviteResult = 'Not requested';
      let deliveryStatus = 'SKIPPED';
      if (sendInvitations) {
        console.log(`   ✉️ Requesting password setup delivery via ${inviteChannel}...`);
        const res = await issuePasswordSetupInvitation(supabase, pgClient, {
          email,
          role: record.role,
          identifier: targetIdentifier,
          userId: existingProfile?.id || existingAuth?.id,
          siteUrl,
          deliveryChannel: inviteChannel,
        });
        inviteResult = res.message;
        deliveryStatus = res.status;
        if (res.success) {
          console.log(`      ✅ ${res.message}`);
        } else {
          console.warn(`      ⚠️ ${res.message}`);
        }
      }

      results.push({
        name: record.name,
        email,
        role: record.role,
        identifier: targetIdentifier,
        loginId: targetLoginId,
        status: 'SUCCESS_NOOP',
        invitation: inviteResult,
        delivery_status: deliveryStatus,
      });
      continue;
    }

    let authUserId = existingAuth?.id;
    let newlyCreatedAuthId = null;

    try {
      // 1. Establish or update Supabase Auth identity
      if (!existingAuth) {
        console.log(`   1. Creating canonical Supabase Auth user via Admin API...`);
        const createPayload = {
          email,
          email_confirm: true,
          user_metadata: {
            name: record.name,
            role: record.role,
            identifier: targetIdentifier,
          },
        };
        // If an authoritative profile already exists in Azure PG, preserve its UUID in Supabase Auth
        if (existingProfile?.id) {
          createPayload.id = existingProfile.id;
          console.log(`      ℹ️ Preserving existing profile UUID in Supabase Auth: ${existingProfile.id}`);
        }
        const { data: newAuthData, error: newAuthErr } = await supabase.auth.admin.createUser(createPayload);
        if (newAuthErr || !newAuthData.user) {
          throw new Error(`Failed to create Supabase Auth user: ${newAuthErr?.message}`);
        }
        authUserId = newAuthData.user.id;
        newlyCreatedAuthId = authUserId;
        console.log(`      ✅ Auth user created (UUID: ${authUserId})`);
      } else {
        console.log(`   1. Updating Supabase Auth metadata for user ${existingAuth.id}...`);
        authUserId = existingAuth.id;
        const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            ...existingAuth.user_metadata,
            name: record.name,
            role: record.role,
            identifier: targetIdentifier,
          },
        });
        if (updateAuthErr) {
          console.warn(`      ⚠️ Warning updating Auth metadata: ${updateAuthErr.message}`);
        } else {
          console.log(`      ✅ Auth user metadata updated to role "${record.role}"`);
        }
      }

      // Sync Supabase hosted PostgREST profiles mirror (needed for proxy.ts route guard)
      try {
        await supabase.from('profiles').upsert({
          id: authUserId,
          role: record.role,
          name: record.name,
          email,
        });
        console.log(`      ✅ Supabase hosted profiles mirror synchronized.`);
      } catch (mirrorErr) {
        console.warn(`      ⚠️ Non-fatal: Supabase hosted profiles mirror sync notice: ${mirrorErr.message}`);
      }

      // 2. Azure PostgreSQL Transaction
      console.log(`   2. Executing Azure PostgreSQL profile transaction...`);
      await pgClient.query('BEGIN');

      // If existing unlinked placeholder profile exists with a different UUID, verify 0 inbound FKs and migrate
      if (existingProfile && existingProfile.id !== authUserId) {
        console.log(`      ℹ️ Migrating unlinked placeholder profile ${existingProfile.id} -> ${authUserId}...`);
        const fkCheck = await pgClient.query(
          `SELECT (
             (SELECT count(*) FROM public.judge_reviews WHERE judge_id = $1) +
             (SELECT count(*) FROM public.teams WHERE created_by = $1) +
             (SELECT count(*) FROM public.team_members WHERE user_id = $1) +
             (SELECT count(*) FROM public.audit_logs WHERE user_id = $1)
           ) AS total_fks`,
          [existingProfile.id]
        );
        const totalFks = parseInt(fkCheck.rows[0]?.total_fks || '0', 10);
        if (totalFks > 0) {
          throw new Error(`Safety violation: Cannot migrate placeholder profile ${existingProfile.id} because ${totalFks} inbound foreign key references exist.`);
        }
        await pgClient.query(`DELETE FROM public.profiles WHERE id = $1`, [existingProfile.id]);
        await pgClient.query(`DELETE FROM auth.users WHERE id = $1`, [existingProfile.id]);
        console.log(`      ✅ Safely vacated unlinked placeholder profile row.`);
      }

      // Shadow in auth.users
      await pgClient.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data, email = EXCLUDED.email`,
        [authUserId, email, JSON.stringify({ name: record.name, role: record.role, identifier: targetIdentifier })]
      );

      // Upsert public.profiles
      await pgClient.query(
        `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, login_id, team_id, is_disabled)
         VALUES ($1, $2, $3, '', $4, $5, $6, NULL, false)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           identifier = EXCLUDED.identifier,
           login_id = EXCLUDED.login_id,
           team_id = NULL,
           is_disabled = false,
           updated_at = NOW()`,
        [authUserId, record.name, email, record.role, targetIdentifier, targetLoginId]
      );

      // Audit Log
      await pgClient.query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, $2, 'profiles', $3, $4)`,
        [
          authUserId,
          `${record.role.toUpperCase()}_ACCOUNT_PROVISIONED`,
          authUserId,
          JSON.stringify({
            role: record.role,
            identifier: targetIdentifier,
            login_id: targetLoginId,
            previous_role: existingProfile?.role || null,
            previous_identifier: existingProfile?.identifier || null,
            migrated_from_profile_id: existingProfile && existingProfile.id !== authUserId ? existingProfile.id : null,
          }),
        ]
      );

      await pgClient.query('COMMIT');
      console.log(`      ✅ Azure PostgreSQL profile committed (Role: ${record.role}, ID: ${targetIdentifier}, Login: ${targetLoginId})`);

      // 3. Password Setup / Invitation link
      let inviteResult = 'Not requested';
      let deliveryStatus = 'SKIPPED';
      if (sendInvitations) {
        console.log(`   3. Requesting password setup delivery via ${inviteChannel}...`);
        const res = await issuePasswordSetupInvitation(supabase, pgClient, {
          email,
          role: record.role,
          identifier: targetIdentifier,
          userId: authUserId,
          siteUrl,
          deliveryChannel: inviteChannel,
        });
        inviteResult = res.message;
        deliveryStatus = res.status;
        if (res.success) {
          console.log(`      ✅ ${res.message}`);
        } else {
          console.warn(`      ⚠️ ${res.message}`);
        }
      }

      results.push({
        name: record.name,
        email,
        role: record.role,
        identifier: targetIdentifier,
        loginId: targetLoginId,
        status: 'SUCCESS',
        invitation: inviteResult,
        delivery_status: deliveryStatus,
      });
    } catch (stepErr) {
      await pgClient.query('ROLLBACK').catch(() => { });
      console.error(`   ❌ Failed processing ${email}: ${stepErr.message}`);

      // Compensating Rollback if Auth user was created during this step
      if (newlyCreatedAuthId) {
        console.warn(`   ⚠️ Triggering compensating rollback: deleting orphaned Supabase Auth user ${newlyCreatedAuthId}...`);
        try {
          const { error: delErr } = await supabase.auth.admin.deleteUser(newlyCreatedAuthId);
          try {
            await supabase.from('profiles').delete().eq('id', newlyCreatedAuthId);
          } catch (_) { }
          if (delErr) {
            console.error(`   🔥 CRITICAL: Compensating delete failed for ${newlyCreatedAuthId}: ${delErr.message}`);
            recordDeadLetter({
              authUserId: newlyCreatedAuthId,
              email,
              role: record.role,
              identifier: targetIdentifier,
              error: delErr.message,
              underlyingError: stepErr.message,
              recoveryAction: `node scripts/recover-orphaned-auth.mjs --auth-id ${newlyCreatedAuthId}`,
            });
          } else {
            console.log(`   ✅ Compensating rollback complete: orphaned Auth user removed cleanly.`);
          }
        } catch (compErr) {
          console.error(`   🔥 CRITICAL: Compensating delete exception for ${newlyCreatedAuthId}: ${compErr.message}`);
          recordDeadLetter({
            authUserId: newlyCreatedAuthId,
            email,
            role: record.role,
            identifier: targetIdentifier,
            error: compErr.message,
            underlyingError: stepErr.message,
            recoveryAction: `node scripts/recover-orphaned-auth.mjs --auth-id ${newlyCreatedAuthId}`,
          });
        }
      }

      results.push({
        name: record.name,
        email,
        role: record.role,
        identifier: targetIdentifier,
        loginId: targetLoginId,
        status: 'FAILED',
        error: stepErr.message,
      });
    }
  }

  return results;
}

// ── Main Controller ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !args.includes('--execute');
  const isExecute = args.includes('--execute');
  const confirmArg = args[args.indexOf('--confirm') + 1];
  const inputArg = args[args.indexOf('--input') + 1];
  const sendInvitations = args.includes('--send-invitations');
  const inviteChannel = args.includes('--invite-channel')
    ? args[args.indexOf('--invite-channel') + 1]
    : 'supabase-mailer';
  const isSyntheticTest = args.includes('--test-synthetic');
  const isStaging = args.includes('--staging') || (databaseUrl || '').includes('cem_staging');
  const isProduction = args.includes('--production') || (process.env.NODE_ENV === 'production' && isExecute && !isStaging);

  checkEnv(sendInvitations, isProduction, isStaging);

  if (isExecute && !isStaging && !args.includes('--production-confirmed')) {
    console.error('\n❌ Execution halted: Direct execution against production database requires explicit flag: --production-confirmed');
    process.exitCode = 1;
    return;
  }

  console.log('================================================================');
  console.log('   Code-e-Manipal 2.0 — Admin & Judge Provisioning Utility');
  console.log('================================================================');
  console.log(`Mode:            ${isDryRun ? 'DRY-RUN (Safe, no writes)' : 'EXECUTE (Live production changes)'}`);
  console.log(`Send Invites:    ${sendInvitations ? `YES (${inviteChannel})` : 'NO'}`);
  console.log(`Input File:      ${inputArg || '(None provided)'}`);
  console.log(`Site URL:        ${siteUrl}${siteUrl.includes('localhost') ? ' (LOCAL DEV / DRY-RUN ONLY)' : ''}`);
  console.log(`Redirect Target: ${siteUrl}/auth/setup-password`);
  console.log('----------------------------------------------------------------');

  const pgClient = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Advisory lock
    await pgClient.query("SELECT pg_advisory_xact_lock(hashtext('code-e-manipal-account-provisioning'))");

    if (isSyntheticTest) {
      const res = await runSyntheticTest(pgClient, supabase);
      if (!res.success) {
        process.exitCode = 1;
      }
      return;
    }

    if (!inputArg) {
      console.error('❌ Error: Please specify an input roster file using --input <path>');
      console.error('   Example: node --env-file=.env.local scripts/provision-admin-judge.mjs --input data/rosters/admins.json --dry-run');
      process.exitCode = 1;
      return;
    }

    const inputPath = path.resolve(process.cwd(), inputArg);
    if (!fs.existsSync(inputPath)) {
      console.error(`❌ Error: Input file not found: ${inputPath}`);
      process.exitCode = 1;
      return;
    }

    const fileContent = fs.readFileSync(inputPath, 'utf8');
    let parsedJson;
    try {
      parsedJson = JSON.parse(fileContent);
    } catch (e) {
      console.error(`❌ Error parsing JSON from ${inputPath}: ${e.message}`);
      process.exitCode = 1;
      return;
    }

    // Support { admins: [...] }, { judges: [...] }, or [...]
    let rawRecords = [];
    if (Array.isArray(parsedJson)) {
      rawRecords = parsedJson;
    } else if (Array.isArray(parsedJson.admins)) {
      rawRecords = parsedJson.admins.map(a => ({ ...a, role: 'admin' }));
    } else if (Array.isArray(parsedJson.judges)) {
      rawRecords = parsedJson.judges.map(j => ({ ...j, role: 'judge' }));
    } else {
      console.error('❌ Error: Input JSON must be an array or contain an "admins" or "judges" array property.');
      process.exitCode = 1;
      return;
    }

    console.log(`\n1. Validating roster (${rawRecords.length} records)...`);
    const { errors, warnings, validRecords } = validateRoster(rawRecords);

    if (warnings.length > 0) {
      console.log('⚠️ Warnings:');
      warnings.forEach(w => console.log(`   - ${w}`));
    }

    if (errors.length > 0) {
      console.error('\n❌ Roster Preflight Validation Failed:');
      errors.forEach(e => console.error(`   - ${e}`));
      process.exitCode = 1;
      return;
    }
    console.log(`   ✅ Preflight validation passed: ${validRecords.length} valid accounts.`);

    console.log('\n2. Fetching current Azure PG and Supabase Auth state...');
    const systemState = await fetchSystemState(pgClient, supabase);
    console.log(`   - Existing profiles in Azure PG: ${systemState.profiles.length}`);
    console.log(`   - Existing users in Supabase Auth: ${systemState.authUsers.length}`);

    console.log('\n3. Evaluating reconciliation and canonical identifiers...');
    const allocatedIdentifiers = new Set();
    const allocatedLogins = new Set();
    const plans = validRecords.map(rec =>
      analyzeReconciliation(rec, systemState, allocatedIdentifiers, allocatedLogins)
    );

    console.log('\n📋 Reconciliation Plan Summary:');
    console.table(
      plans.map(p => ({
        Name: p.record.name,
        Email: p.record.email,
        Role: p.record.role,
        Target_ID: p.targetIdentifier,
        Target_Login: p.targetLoginId,
        Status: p.status,
      }))
    );

    console.log('\nDetailed Action Plans:');
    plans.forEach(p => {
      console.log(`\n• [${p.record.role.toUpperCase()}] ${p.record.name} (${p.record.email}):`);
      console.log(`  Target Canonical ID: ${p.targetIdentifier}`);
      console.log(`  Target Login ID:    ${p.targetLoginId}`);
      console.log(`  Classification:     ${p.status}`);
      p.actions.forEach(a => console.log(`    ↳ ${a}`));
    });

    if (isDryRun) {
      console.log('\n================================================================');
      console.log('✅ DRY-RUN COMPLETED SUCCESSFULLY.');
      console.log('   No changes were written to Azure PostgreSQL or Supabase Auth.');
      console.log('   No invitation emails or setup links were requested.');
      console.log('\nTo execute live changes, run with:');
      console.log(`   node --env-file=.env.local scripts/provision-admin-judge.mjs --input ${inputArg} --execute --confirm yes`);
      console.log('================================================================');
      return;
    }

    // Guarded Execution
    if (confirmArg !== 'yes' && confirmArg !== 'production') {
      console.error('\n❌ Execution halted: Missing required confirmation flag: --confirm yes');
      process.exitCode = 1;
      return;
    }

    const results = await executeProvisioning(plans, pgClient, supabase, {
      sendInvitations,
      inviteChannel,
    });

    console.log('\n================================================================');
    console.log('🏁 EXECUTION RESULTS:');
    console.table(results);
    console.log('================================================================');
  } finally {
    await pgClient.end();
  }
}

// Run if called as CLI script
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMainModule || process.argv[1]?.includes('provision-admin-judge')) {
  main().catch(err => {
    console.error('💥 Fatal error in provisioning utility:', err);
    process.exit(1);
  });
}
