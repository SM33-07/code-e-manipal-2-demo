/**
 * Centralized Authorization Guards
 *
 * Per Phase 2 specification — all authorization decisions are made through
 * these reusable guards. Every guard enforces ADR-001 (profiles.role is the
 * sole authoritative source) and integrates with the session lifecycle.
 *
 * Guards:
 * - requireRole: Role hierarchy check (admin > judge > participant)
 * - requireTeamAccess: Verify user belongs to the target team
 * - requireSubmissionOwnership: Verify user's team owns the submission
 * - requireJudgeAssignment: Verify judge is assigned to the submission
 * - requireEventPhase: Verify current event phase matches required phase(s)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession, ValidatedSession } from './session';
import { validateCsrf } from './csrf';
import { query } from '@/lib/db';
import type { UserRole } from '@/types';
import { Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import type { EventConfigState } from '@/lib/event/eventConfigHelper';

// ────────────────────────────────────────────────────────
// Core Auth Handler Types
// ────────────────────────────────────────────────────────

export interface AuthContext extends ValidatedSession {
  params?: Record<string, string>;
}

export type GuardedHandler = (
  req: NextRequest,
  ctx: AuthContext
) => Promise<NextResponse>;

// ────────────────────────────────────────────────────────
// Enhanced withAuth (replaces lib/middleware/withAuth.ts)
// ────────────────────────────────────────────────────────

/**
 * Enhanced auth middleware wrapper.
 *
 * Improvements over the original withAuth:
 * 1. Integrates session lifecycle (force_logout_before, is_disabled)
 * 2. CSRF validation for state-changing methods
 * 3. Uses the centralized validateSession() instead of ad-hoc profile lookup
 * 4. Role hierarchy enforcement
 *
 * @param handler - The route handler to protect
 * @param requiredRole - Optional minimum role required
 */
export function withGuardedAuth(handler: GuardedHandler, requiredRole?: UserRole) {
  return async (
    req: NextRequest,
    ...args: any[]
  ): Promise<NextResponse> => {
    const context = args[0] as { params?: Record<string, string> | Promise<Record<string, string>> } | undefined;
    try {
      // 1. CSRF validation for state-changing requests
      const csrfError = validateCsrf(req);
      if (csrfError) return csrfError;

      // 2. Session validation (GoTrue + profile + lifecycle checks)
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

      // 3. Role hierarchy check
      if (requiredRole && !hasRole(session.profile.role as UserRole, requiredRole)) {
        return Errors.FORBIDDEN();
      }

      // 4. Resolve params (Next.js 16 may pass as Promise)
      const resolvedParams = context?.params instanceof Promise
        ? await context.params
        : context?.params;

      // 5. Execute handler
      return handler(req, {
        user: session.user,
        profile: session.profile,
        params: resolvedParams,
      });
    } catch (err) {
      logger.error('withGuardedAuth unexpected error', { error: String(err) });
      return Errors.INTERNAL();
    }
  };
}

// ────────────────────────────────────────────────────────
// Role Hierarchy
// ────────────────────────────────────────────────────────

const ROLE_RANK: Record<UserRole, number> = {
  participant: 0,
  judge: 1,
  admin: 2,
};

/**
 * Role hierarchy check: admin > judge > participant.
 * Returns true if userRole meets or exceeds requiredRole.
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[requiredRole] ?? 0);
}

// ────────────────────────────────────────────────────────
// Resource Access Guards
// ────────────────────────────────────────────────────────

/**
 * Verify that the authenticated user belongs to the specified team.
 *
 * @param userId - The authenticated user's ID
 * @param teamId - The team to check membership for
 * @returns true if the user is a member of the team
 */
export async function requireTeamAccess(userId: string, teamId: string): Promise<boolean> {
  const { rows } = await query(
    'SELECT 1 FROM public.team_members WHERE user_id = $1 AND team_id = $2 LIMIT 1',
    [userId, teamId]
  );
  return rows.length > 0;
}

/**
 * Verify that the authenticated user's team owns the specified submission.
 *
 * @param userId - The authenticated user's ID
 * @param submissionId - The submission to check ownership for
 * @returns The submission's team_id if owned, null otherwise
 */
export async function requireSubmissionOwnership(
  userId: string,
  submissionId: string
): Promise<string | null> {
  const { rows } = await query(
    `SELECT s.team_id
     FROM public.submissions s
     JOIN public.team_members tm ON tm.team_id = s.team_id
     WHERE s.id = $1 AND tm.user_id = $2
     LIMIT 1`,
    [submissionId, userId]
  );
  return rows[0]?.team_id || null;
}

/**
 * Verify that a judge is assigned to evaluate the specified submission.
 *
 * @param judgeId - The judge's user ID
 * @param submissionId - The submission to check assignment for
 * @returns true if the judge is assigned
 */
export async function requireJudgeAssignment(
  judgeId: string,
  submissionId: string
): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM public.judge_assignments
     WHERE judge_id = $1 AND submission_id = $2
     LIMIT 1`,
    [judgeId, submissionId]
  );
  return rows.length > 0;
}

/**
 * Verify that the current event phase matches one of the required phases.
 * Uses direct database query with row lock for transactional safety.
 *
 * @param allowedPhases - Array of allowed event phases
 * @param forUpdate - If true, acquires FOR UPDATE lock (for mutations)
 * @returns The current event phase if allowed, null if rejected
 */
export async function requireEventPhase(
  allowedPhases: EventConfigState['event_phase'][],
  forUpdate = false
): Promise<EventConfigState['event_phase'] | null> {
  const lockClause = forUpdate ? 'FOR UPDATE' : '';
  const { rows } = await query(
    `SELECT event_phase FROM public.event_config WHERE id = 1 ${lockClause}`
  );

  const currentPhase = rows[0]?.event_phase;
  if (!currentPhase || !allowedPhases.includes(currentPhase)) {
    return null;
  }

  return currentPhase;
}

/**
 * Transaction helper for phase-locked mutations (Anti-TOCTOU Invariant).
 *
 * Acquires a row-level lock on event_config, verifies the phase,
 * and executes the mutation within the same transaction.
 *
 * Per ADR-004: Catches serialization failures (40001) and deadlocks (40P01)
 * and retries up to 3 times with exponential backoff and jitter.
 *
 * @param allowedPhases - Phases in which the mutation is permitted
 * @param mutationFn - The mutation function to execute within the transaction
 * @param maxRetries - Maximum retry attempts for serialization failures
 * @returns The mutation result or an error response
 */
export async function withPhaseLock<T>(
  allowedPhases: EventConfigState['event_phase'][],
  mutationFn: (phase: EventConfigState['event_phase']) => Promise<T>,
  maxRetries = 3
): Promise<
  | { data: T; error: null }
  | { data: null; error: 'PHASE_MISMATCH' | 'SERIALIZATION_EXHAUSTED' | 'INTERNAL' }
> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await query('BEGIN');

      // Acquire row lock and verify phase
      const { rows } = await query(
        'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
      );

      const currentPhase = rows[0]?.event_phase;
      if (!currentPhase || !allowedPhases.includes(currentPhase)) {
        await query('ROLLBACK');
        return { data: null, error: 'PHASE_MISMATCH' };
      }

      // Execute the mutation within the transaction
      const result = await mutationFn(currentPhase);

      await query('COMMIT');
      return { data: result, error: null };
    } catch (err: any) {
      await query('ROLLBACK').catch(() => { /* best-effort rollback */ });

      const pgCode = err?.code;

      // Serialization failure (40001) or deadlock (40P01) — retry
      if ((pgCode === '40001' || pgCode === '40P01') && attempt < maxRetries - 1) {
        // Exponential backoff with randomized jitter (50ms–200ms)
        const baseDelay = Math.pow(2, attempt) * 50;
        const jitter = Math.random() * 150;
        const delay = baseDelay + jitter;
        logger.warn('Phase lock serialization conflict, retrying', {
          attempt: attempt + 1,
          maxRetries,
          pgCode,
          delayMs: Math.round(delay),
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      logger.error('Phase lock transaction failed', {
        error: String(err),
        pgCode,
        attempt: attempt + 1,
      });

      if (pgCode === '40001' || pgCode === '40P01') {
        return { data: null, error: 'SERIALIZATION_EXHAUSTED' };
      }

      return { data: null, error: 'INTERNAL' };
    }
  }

  return { data: null, error: 'SERIALIZATION_EXHAUSTED' };
}
