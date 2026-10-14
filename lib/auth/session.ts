/**
 * Session Validation & Lifecycle Management
 *
 * Per Phase 2 specification:
 * - Session token validation via Supabase GoTrue
 * - force_logout_before timestamp enforcement
 * - is_disabled account lockout enforcement
 * - Profile hydration from Azure Postgres (ADR-001: profiles.role is sole authority)
 *
 * Session Lifecycle Rules:
 * - Normal Logout: Clears cookie, revokes GoTrue session
 * - Password Reset: Sets force_logout_before = NOW(), revokes all sessions
 * - Admin Force Logout: Sets force_logout_before = NOW(); next request returns 401
 * - Account Disable: Sets is_disabled = true; guards immediately return 403
 * - Role Change: Updates profiles.role; immediate effect (no JWT re-issuance needed)
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { query } from '@/lib/db';
import type { Profile, UserRole } from '@/types';
import type { User } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export interface ValidatedSession {
  /** Supabase GoTrue user object */
  user: User;
  /** Authoritative profile from Azure Postgres (ADR-001) */
  profile: Profile;
}

/**
 * Validates the current session and returns the authenticated user + profile.
 *
 * Enforcement chain:
 * 1. Validate GoTrue session token
 * 2. Hydrate profile from profiles table
 * 3. Check is_disabled → 403
 * 4. Check force_logout_before → 401
 * 5. Return validated session
 *
 * @returns ValidatedSession if valid, null with a reason code if invalid
 */
export async function validateSession(): Promise<
  | { session: ValidatedSession; error: null }
  | { session: null; error: 'UNAUTHENTICATED' | 'DISABLED' | 'FORCE_LOGOUT' | 'NO_PROFILE' | 'DB_ERROR' }
> {
  try {
    // 1. Validate GoTrue session (cookie or Authorization: Bearer <token>)
    const headerList = await headers();
    const authHeader = headerList.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(bearerToken);

    if (error || !user) {
      return { session: null, error: 'UNAUTHENTICATED' };
    }

    // 2. Hydrate profile from Azure Postgres (ADR-001: sole authoritative source)
    let profile: (Profile & SessionProfileExtensions) | null = null;
    try {
      profile = await lookupProfile(user.id);

      // Lazy profile sync if missing (first-login scenario)
      if (!profile) {
        profile = await lazyProfileSync(user);
      }
    } catch (dbErr) {
      logger.error('Session validation: database profile query failed', {
        userId: user.id,
        error: String(dbErr),
      });
      return { session: null, error: 'DB_ERROR' };
    }

    if (!profile) {
      logger.warn('Session validation: profile not found after sync attempt', {
        userId: user.id,
        email: user.email,
      });
      return { session: null, error: 'NO_PROFILE' };
    }

    // 3. Check account disabled status
    if (profile.is_disabled) {
      logger.info('Session validation: disabled account attempted access', {
        userId: user.id,
        identifier: profile.identifier,
      });
      return { session: null, error: 'DISABLED' };
    }

    // 4. Check force_logout_before timestamp
    if (profile.force_logout_before) {
      const forceLogoutAt = new Date(profile.force_logout_before);
      const sessionCreatedAt = user.created_at ? new Date(user.created_at) : null;
      const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
      const userUpdatedAt = user.updated_at ? new Date(user.updated_at) : null;

      // Use the most recent session activity timestamp
      const sessionTimestamp = lastSignInAt || userUpdatedAt || sessionCreatedAt;

      // Allow a 2000ms clock skew buffer between database server and auth server
      if (sessionTimestamp && (sessionTimestamp.getTime() + 2000) < forceLogoutAt.getTime()) {
        logger.info('Session validation: force logout enforcement', {
          userId: user.id,
          forceLogoutBefore: forceLogoutAt.toISOString(),
          sessionTimestamp: sessionTimestamp.toISOString(),
        });
        return { session: null, error: 'FORCE_LOGOUT' };
      }
    }

    // 5. Session is valid
    return {
      session: { user, profile },
      error: null,
    };
  } catch (err) {
    logger.error('Session validation unexpected error', { error: String(err) });
    return { session: null, error: 'UNAUTHENTICATED' };
  }
}

/**
 * Look up a profile from the Azure Postgres profiles table.
 */
async function lookupProfile(userId: string): Promise<(Profile & SessionProfileExtensions) | null> {
    const { rows } = await query(
    `SELECT id, name, email, avatar_url, role, identifier, login_id,
            force_logout_before, is_disabled,
            created_at, updated_at
     FROM public.profiles WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Lazily sync a GoTrue user to Azure Postgres on first login.
 * Creates the auth.users + profiles rows if missing.
 */
async function lazyProfileSync(user: User): Promise<(Profile & SessionProfileExtensions) | null> {
  const meta = user.user_metadata || {};

  try {
    // Attempt auth.users sync (trigger may create profile)
    await query(
      'INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [user.id, user.email || '', JSON.stringify(meta)]
    );
  } catch (e) {
    logger.warn('auth.users lazy sync failed, attempting direct profiles insert', {
      error: String(e),
    });
  }

  // Direct profiles insert as fallback
  // Missing Azure profiles must never inherit an elevated role from Auth metadata.
  await query(
    `INSERT INTO public.profiles (id, name, email, avatar_url, role, identifier)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      user.id,
      meta.name || user.email?.split('@')[0] || 'Unknown',
      user.email || '',
      meta.avatar_url || '',
      'participant',
      meta.identifier || `USER-${user.id.substring(0, 8).toUpperCase()}`,
    ]
  );

  // Re-fetch
  return lookupProfile(user.id);
}

/**
 * Extended profile fields used internally for session lifecycle checks.
 * These are not part of the public Profile type but are needed for auth.
 */
interface SessionProfileExtensions {
  identifier?: string;
  login_id?: string | null;
  force_logout_before?: string | null;
  is_disabled?: boolean;
}
