/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's session and profile.
 *
 * Per ADR-001: profiles.role from Azure Postgres is the SOLE
 * authoritative source for role information. user_metadata.role
 * from GoTrue is included only as a non-authoritative convenience
 * cache for client-side optimistic rendering.
 *
 * Enforces full session lifecycle:
 * - is_disabled → 403
 * - force_logout_before → 401
 */

import { NextRequest } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { emailToIdentifier } from '@/lib/auth/identifier';
import { Errors, successResponse } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

export async function GET(_req: NextRequest) {
  try {
    const result = await validateSession();

    if (result.error) {
      switch (result.error) {
        case 'DISABLED':
          return Errors.FORBIDDEN();
        case 'DB_ERROR':
          return Errors.INTERNAL('Database temporarily unavailable. Please retry.');
        case 'UNAUTHENTICATED':
        case 'FORCE_LOGOUT':
        case 'NO_PROFILE':
        default:
          return Errors.UNAUTHORIZED();
      }
    }

    const { session } = result;
    const { user, profile } = session;

    // Extract canonical identifier from profile or email
    const identifier =
      (profile as any).identifier ||
      emailToIdentifier(user.email || '') ||
      null;
    const loginId = (profile as any).login_id || null;

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        identifier,
        login_id: loginId,
      },
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        role: profile.role,           // ← Authoritative (ADR-001)
        identifier,
        login_id: loginId,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (err) {
    logger.error('GET /api/auth/me unexpected error', { error: String(err) });
    return Errors.INTERNAL();
  }
}
