import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateAdminPassword, generateEventPassword, generateJudgePassword, generateParticipantPasscode } from '@/lib/admin/passwords';
import { identifierToEmail, normalizeIdentifier, personalizedLoginId } from '@/lib/auth/identifier';
import { pool, query } from '@/lib/db';
import type { UserRole } from '@/types';
import { logger } from '@/lib/utils/logger';

const CANONICAL_PREFIX: Record<UserRole, string> = { participant: 'TEAM', judge: 'JUDGE', admin: 'ADMIN' };

export interface ProvisionAccountInput {
  name: string;
  role: UserRole;
  canonicalIdentifier?: string;
  email?: string;
  password?: string;
}

export interface ProvisionedAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  identifier: string;
  login_id: string | null;
  password: string;
  verification: {
    azureProfile: boolean;
    authMetadata: boolean;
    authenticated: boolean;
  };
}

export class ProvisioningError extends Error {
  public readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = 'ProvisioningError';
  }
}

async function findAuthUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new ProvisioningError('Unable to inspect existing authentication accounts', 500);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) break;
  }
  return null;
}

export async function nextCanonicalIdentifier(client: any, role: UserRole): Promise<string> {
  const prefix = CANONICAL_PREFIX[role];
  const { rows } = await client.query(
    `SELECT identifier, login_id FROM public.profiles
     WHERE UPPER(identifier) LIKE $1 OR UPPER(COALESCE(login_id, '')) LIKE $1
     FOR UPDATE`,
    [`${prefix}-%`]
  );
  const used = new Set(
    rows.flatMap((row: { identifier: string; login_id?: string | null }) =>
      [row.identifier, row.login_id].filter(Boolean).map((value) => String(value).toUpperCase())
    )
  );
  const max = role === 'participant' ? 999 : 99;
  for (let index = 1; index <= max; index += 1) {
    const candidate = `${prefix}-${String(index).padStart(role === 'participant' ? 3 : 2, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new ProvisioningError(`No unused canonical ${role} identifier is available`, 409);
}

export async function nextLoginId(client: any, role: 'judge' | 'admin', name: string): Promise<string> {
  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const candidate = personalizedLoginId(role, name, suffix);
    const { rows } = await client.query(
      `SELECT 1 FROM public.profiles
       WHERE UPPER(TRIM(identifier)) = $1 OR UPPER(TRIM(COALESCE(login_id, ''))) = $1
       LIMIT 1`,
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }
  throw new ProvisioningError('Unable to allocate a unique personalized login identifier', 409);
}

async function recordReconciliation(operationId: string, authUserId: string, profileId: string | null, stage: string, errorMessage: string) {
  await query(
    `INSERT INTO public.provisioning_reconciliation
       (operation_id, auth_user_id, profile_id, stage, status, error_message)
     VALUES ($1, $2, $3, $4, 'PENDING_AUTH_CLEANUP', $5)
     ON CONFLICT (operation_id) DO UPDATE SET
       status = 'PENDING_AUTH_CLEANUP', error_message = EXCLUDED.error_message,
       retry_count = public.provisioning_reconciliation.retry_count + 1`,
    [operationId, authUserId, profileId, stage, errorMessage.slice(0, 1000)]
  );
}

export async function provisionAccount(input: ProvisionAccountInput, actorId?: string): Promise<ProvisionedAccount> {
  const operationId = crypto.randomUUID();
  const name = input.name.trim();
  if (!name || name.length > 120) throw new ProvisioningError('Name must be between 1 and 120 characters');
  if (!['participant', 'judge', 'admin'].includes(input.role)) throw new ProvisioningError('Role must be participant, judge, or admin');
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim().toLowerCase())) {
    throw new ProvisioningError('Invalid email format');
  }
  if (input.password !== undefined && input.password.length < 6) throw new ProvisioningError('Password must be at least 6 characters');

  const client = await pool.connect();
  const supabase = createSupabaseAdminClient();
  let createdAuthUserId: string | null = null;
  let transactionStarted = false;
  let profileId: string | null = null;
  let criticalReconciliationFailure = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('code-e-manipal-account-provisioning'))");

    const canonicalIdentifier = input.canonicalIdentifier ? normalizeIdentifier(input.canonicalIdentifier) : null;
    if (input.canonicalIdentifier && (!canonicalIdentifier || canonicalIdentifier.role !== input.role)) {
      throw new ProvisioningError(`Identifier must match the ${input.role} canonical format`);
    }
    const identifier = canonicalIdentifier?.canonical || await nextCanonicalIdentifier(client, input.role);
    const existingIdentifier = await client.query(
      `SELECT id FROM public.profiles WHERE UPPER(TRIM(identifier)) = $1 OR UPPER(TRIM(COALESCE(login_id, ''))) = $1 LIMIT 1`,
      [identifier]
    );
    if (existingIdentifier.rows.length > 0) throw new ProvisioningError('That canonical identifier is already assigned', 409);

    const loginId = input.role === 'participant' ? null : await nextLoginId(client, input.role, name);
    const email = input.email?.trim().toLowerCase() || identifierToEmail(identifier);
    const existingProfile = await client.query('SELECT id FROM public.profiles WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    if (existingProfile.rows.length > 0) throw new ProvisioningError('A profile already exists for this email', 409);
    const existingAuthUser = await findAuthUserByEmail(email);
    if (existingAuthUser) throw new ProvisioningError('An authentication account already exists for this identity; reconcile it before provisioning again', 409);

    const password = input.password ?? (
      input.role === 'admin'
        ? generateAdminPassword(18)
        : input.role === 'participant'
        ? generateParticipantPasscode(8)
        : generateJudgePassword(16)
    );
    const metadata = { name, role: input.role, identifier, login_id: loginId };
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
    if (authError || !authData.user) throw new ProvisioningError('Failed to create authentication account', 500);
    createdAuthUserId = authData.user.id;
    profileId = createdAuthUserId;

    await client.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [createdAuthUserId, email, JSON.stringify(metadata)]
    );
    const { rows: profileRows } = await client.query(
      `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier, login_id)
       VALUES ($1, $2, $3, '', $4, $5, $6)
       RETURNING id, name, email, role, identifier, login_id`,
      [createdAuthUserId, name, email, input.role, identifier, loginId]
    );
    const profile = profileRows[0];

    const { data: verifiedAuth, error: authReadError } = await supabase.auth.admin.getUserById(createdAuthUserId);
    const authRole = verifiedAuth?.user?.user_metadata?.role;
    if (authReadError || authRole !== input.role) throw new ProvisioningError('Supabase Auth role mirror verification failed', 500);
    const { rows: verifiedProfileRows } = await client.query(`SELECT id, role, identifier, login_id FROM public.profiles WHERE id = $1 LIMIT 1`, [createdAuthUserId]);
    const verifiedProfile = verifiedProfileRows[0];
    const azureProfileVerified = Boolean(verifiedProfile && verifiedProfile.role === input.role && verifiedProfile.identifier === identifier && (verifiedProfile.login_id || null) === loginId);
    if (!azureProfileVerified) throw new ProvisioningError('Azure profile verification failed', 500);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    const authenticated = !signInError && signInData.user?.id === createdAuthUserId;
    if (!authenticated) throw new ProvisioningError('Provisioned credential authentication verification failed', 500);

    if (actorId) {
      await client.query(`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details) VALUES ($1, 'ACCOUNT_PROVISIONED', 'profiles', $2, $3)`, [actorId, createdAuthUserId, JSON.stringify({ role: input.role, identifier, login_id: loginId })]);
    }
    await client.query('COMMIT');
    transactionStarted = false;
    return { id: profile.id, name: profile.name, email: profile.email, role: profile.role, identifier: profile.identifier, login_id: profile.login_id, password, verification: { azureProfile: azureProfileVerified, authMetadata: authRole === input.role, authenticated } };
  } catch (error) {
    if (transactionStarted) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        if (createdAuthUserId) {
          try {
            await recordReconciliation(operationId, createdAuthUserId, profileId, 'DATABASE_ROLLBACK_FAILED', rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
          } catch (recordError) {
            criticalReconciliationFailure = true;
            logger.error('CRITICAL_RECONCILIATION_FAILURE', { operationId, authUserId: createdAuthUserId, profileId, stage: 'RECONCILIATION_RECORD_FAILED', underlyingStage: 'DATABASE_ROLLBACK_FAILED', error: String(recordError) });
          }
        }
      }
    }
    if (createdAuthUserId) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(createdAuthUserId);
      if (deleteError) {
        try {
          await recordReconciliation(operationId, createdAuthUserId, profileId, 'AUTH_DELETE_FAILED', deleteError.message);
        } catch (recordError) {
          criticalReconciliationFailure = true;
          logger.error('CRITICAL_RECONCILIATION_FAILURE', { operationId, authUserId: createdAuthUserId, profileId, stage: 'RECONCILIATION_RECORD_FAILED', underlyingStage: 'AUTH_DELETE_FAILED', error: String(recordError) });
        }
      }
    }
    if (criticalReconciliationFailure) {
      throw new ProvisioningError(`CRITICAL_RECONCILIATION_FAILURE:${operationId}`, 500);
    }
    if (error instanceof ProvisioningError) throw error;
    logger.error('Account provisioning failed', { operationId, role: input.role, error: error instanceof Error ? error.message : String(error) });
    throw new ProvisioningError('Account provisioning failed', 500);
  } finally {
    client.release();
  }
}

export async function transitionAccountRole(userId: string, nextRole: UserRole, actorId: string) {
  if (!['participant', 'judge', 'admin'].includes(nextRole)) {
    throw new ProvisioningError('Role must be participant, judge, or admin');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('code-e-manipal-account-provisioning'))");

    const { rows: currentRows } = await client.query(
      'SELECT * FROM public.profiles WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const current = currentRows[0];
    if (!current) throw new ProvisioningError('Profile not found for role update', 404);
    if (current.role === nextRole) {
      await client.query('COMMIT');
      return current;
    }

    // The current schema treats team_id as a participant association. Do not
    // guess whether it should be retained or detached during a role change.
    if (current.team_id) {
      throw new ProvisioningError('Role transition requires explicit team-association reconciliation before changing this account role', 409);
    }

    const identifier = await nextCanonicalIdentifier(client, nextRole);
    const loginId = nextRole === 'participant'
      ? null
      : await nextLoginId(client, nextRole, current.name);

    const { rows: collisionRows } = await client.query(
      `SELECT id FROM public.profiles
       WHERE id <> $4
         AND (UPPER(BTRIM(identifier)) = UPPER(BTRIM($1))
           OR UPPER(BTRIM(COALESCE(login_id, ''))) = UPPER(BTRIM($1)))
       LIMIT 1`,
      [identifier, loginId, nextRole, userId]
    );
    if (collisionRows.length > 0) {
      throw new ProvisioningError('Allocated canonical identifier collides with an existing profile', 409);
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE public.profiles
       SET role = $1, identifier = $2, login_id = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [nextRole, identifier, loginId, userId]
    );
    const updated = updatedRows[0];

    if (nextRole === 'participant') {
      await client.query(
        `UPDATE auth.users
         SET raw_user_meta_data = jsonb_set(
           COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb($2::text), true
         ) - 'login_id'
         WHERE id = $1`,
        [userId, nextRole]
      );
    } else {
      await client.query(
        `UPDATE auth.users
         SET raw_user_meta_data = jsonb_set(
           jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb($2::text), true),
           '{login_id}', to_jsonb($3::text), true
         )
         WHERE id = $1`,
        [userId, nextRole, loginId]
      );
    }

    await client.query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, 'USER_ROLE_CHANGED', 'profiles', $2, $3)`,
      [
        actorId,
        userId,
        JSON.stringify({
          previous_role: current.role,
          new_role: nextRole,
          previous_identifier: current.identifier,
          new_identifier: identifier,
          previous_login_id: current.login_id || null,
          new_login_id: loginId,
        }),
      ]
    );

    await client.query('COMMIT');
    return updated;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      logger.error('Role transition transaction rollback failed', { userId, nextRole, error: String(rollbackError) });
    }
    if (error instanceof ProvisioningError) throw error;
    logger.error('Role transition failed', { userId, nextRole, error: error instanceof Error ? error.message : String(error) });
    throw new ProvisioningError('Role transition failed', 500);
  } finally {
    client.release();
  }
}
