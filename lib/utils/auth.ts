/**
 * Server-side auth utilities — refactored for Phase 2.
 *
 * getServerSession() now delegates to the centralized validateSession()
 * pipeline, which enforces force_logout_before and is_disabled checks.
 *
 * hasRole() delegates to the centralized guards module.
 */

import { validateSession } from '@/lib/auth/session';
import { hasRole as guardHasRole } from '@/lib/auth/guards';
import type { Profile, UserRole } from '@/types';

export interface SessionData {
  userId: string;
  email: string | undefined;
  profile: Profile;
}

/**
 * Get the current server-side session + profile.
 * Returns null if unauthenticated, disabled, or force-logged-out.
 *
 * Now delegates to the centralized session validation pipeline.
 */
export async function getServerSession(): Promise<SessionData | null> {
  const result = await validateSession();

  if (result.error || !result.session) {
    return null;
  }

  return {
    userId: result.session.user.id,
    email: result.session.user.email,
    profile: result.session.profile,
  };
}

/**
 * Role hierarchy check — admin > judge > participant.
 * Returns true if userRole meets or exceeds requiredRole.
 *
 * Delegates to the centralized guards module.
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return guardHasRole(userRole, requiredRole);
}
