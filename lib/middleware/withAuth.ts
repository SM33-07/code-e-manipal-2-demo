/**
 * Centralized Auth Middleware — withAuth
 *
 * REFACTORED for Phase 2 to integrate:
 * 1. Session lifecycle enforcement (force_logout_before, is_disabled)
 * 2. CSRF validation for state-changing methods
 * 3. Centralized session validation via lib/auth/session.ts
 * 4. Role hierarchy from lib/auth/guards.ts
 *
 * This file is the primary auth wrapper used by ALL API route handlers.
 * It replaces the previous ad-hoc profile lookup with the validated
 * session pipeline (ADR-001 compliant).
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { validateCsrf } from '@/lib/auth/csrf';
import { hasRole } from '@/lib/auth/guards';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/types';
import { Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

export type AuthContext = {
  user: User;
  profile: Profile;
  params?: Record<string, string>;
};

export type AuthHandler = (
  req: NextRequest,
  ctx: AuthContext
) => Promise<NextResponse>;

/**
 * Protects a route handler with authentication, authorization, CSRF, and
 * session lifecycle enforcement.
 *
 * @param handler - The route handler function
 * @param requiredRole - Optional minimum role (admin > judge > participant)
 */
export function withAuth(handler: AuthHandler, requiredRole?: UserRole) {
  return async (
    req: NextRequest,
    ...args: any[]
  ): Promise<NextResponse> => {
    const context = args[0] as { params?: Record<string, string> | Promise<Record<string, string>> } | undefined;
    try {
      // ── 1. CSRF validation for state-changing requests ──
      const csrfError = validateCsrf(req);
      if (csrfError) return csrfError;

      // ── 2. Session validation (GoTrue + profile + lifecycle) ──
      const result = await validateSession();

      if (result.error) {
        switch (result.error) {
          case 'UNAUTHENTICATED':
          case 'FORCE_LOGOUT':
          case 'NO_PROFILE':
            return Errors.UNAUTHORIZED();
          case 'DISABLED':
            return Errors.FORBIDDEN();
          default:
            return Errors.UNAUTHORIZED();
        }
      }

      const { session } = result;

      // ── 3. Role hierarchy check (ADR-001: profiles.role is authoritative) ──
      if (requiredRole && !hasRole(session.profile.role as UserRole, requiredRole)) {
        return Errors.FORBIDDEN();
      }

      // ── 4. Resolve params (Next.js 16 may pass as Promise) ──
      const resolvedParams = context?.params instanceof Promise
        ? await context.params
        : context?.params;

      // ── 5. Execute handler ──
      return handler(req, {
        user: session.user,
        profile: session.profile,
        params: resolvedParams,
      });
    } catch (err) {
      logger.error('🔥 withAuth error:', { error: String(err) });
      return Errors.INTERNAL();
    }
  };
}