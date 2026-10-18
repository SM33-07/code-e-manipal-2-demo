/**
 * POST /api/auth/login
 *
 * Identifier-based login endpoint for pre-provisioned hackathon accounts.
 *
 * Flow:
 * 1. Normalize identifier (ADR-009 pipeline: trim → uppercase → regex)
 * 2. Layer 2 rate limit check (campus-NAT-safe token bucket)
 * 3. Layer 1 per-account throttle evaluation (progressive delay)
 * 4. Authenticate via Supabase GoTrue (synthetic email + password)
 * 5. Record telemetry (privacy-minimized: hashed IP, summarized UA)
 * 6. Apply progressive delay (server-side sleep)
 * 7. Return session or generic error (enumeration resistance)
 *
 * Security invariants:
 * - Generic error message on all failures: "Invalid identifier or password."
 * - Zero raw IP storage
 * - No metadata used for authorization (ADR-001)
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeIdentifier, normalizeLoginId, identifierToEmail } from '@/lib/auth/identifier';
import { evaluateLoginThrottle, serverSleep, checkEndpointRateLimit } from '@/lib/auth/throttle';
import { validateCsrf } from '@/lib/auth/csrf';
import { logLoginAttempt, extractClientIp, hashClientIp, summarizeUserAgent } from '@/lib/auth/telemetry';
import { logAudit } from '@/lib/auth/telemetry';
import { logger } from '@/lib/utils/logger';
import { Errors, successResponse } from '@/lib/utils/response';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

import { query } from '@/lib/db';
import { getUserTeamId } from '@/services/submissionService';
import { registerTeamSession, TEAM_MAX_CONCURRENT_SESSIONS } from '@/lib/auth/teamSessionLimit';
import { isDemoMode, assertDemoModeSafety } from '@/lib/demo/demoMode';
import crypto from 'crypto';

/** Generic error message for enumeration resistance (ADR-007) */
const GENERIC_AUTH_ERROR = 'Invalid identifier or password.';

export async function POST(req: NextRequest) {
  try {
    // ── Demo Mode Read-Only Guard ──
    if (isDemoMode()) {
      assertDemoModeSafety();
      return Errors.FORBIDDEN('Demo Mode Active: Authentication and login are disabled in this public read-only demonstration.');
    }

    // ── CSRF validation (browser mutation) ──
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    // ── Parse request body ──
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid request body.');
    }

    const rawIdentifier = body.identifier || body.email || '';
    const password = body.password || '';

    if (!rawIdentifier || !password) {
      return Errors.BAD_REQUEST('identifier and password are required.');
    }

    // ── Step 1: Normalize identifier or email ──
    const trimmedInput = rawIdentifier.trim();
    let identityKey: string;
    let syntheticEmail: string;

    if (trimmedInput.includes('@')) {
      identityKey = trimmedInput.toLowerCase();
      syntheticEmail = identityKey;

      // Authoritative pre-check for email logins: fail closed on DB error, reject disabled accounts
      try {
        const { rows } = await query(
          `SELECT id, email, identifier, login_id, is_disabled FROM public.profiles
           WHERE LOWER(TRIM(email)) = $1
           LIMIT 2`,
          [identityKey]
        );
        if (rows.length > 1) {
          logger.warn('Ambiguous profile email rejected during login', { identityKey });
          await serverSleep(200);
          return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
        }
        if (rows.length === 1 && rows[0].is_disabled) {
          logger.warn('Login attempt for disabled profile by email rejected', { identityKey });
          await serverSleep(200);
          return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
        }
        if (rows.length === 1 && rows[0].identifier) {
          identityKey = rows[0].identifier;
        }
      } catch (dbErr) {
        logger.error('Database error during email profile pre-lookup', { identityKey, error: String(dbErr) });
        return Errors.INTERNAL('Database temporarily unavailable. Please retry.');
      }
    } else {
      const rawUpper = trimmedInput.toUpperCase();
      const rawCompact = rawUpper.replace(/[\s-]/g, '');
      const normalized = normalizeIdentifier(trimmedInput);
      const normalizedLogin = normalizeLoginId(trimmedInput);
      const canonicalKey = normalized?.canonical || normalizedLogin?.canonical || rawUpper;
      const compactCanonical = canonicalKey.replace(/-/g, '');

      // Resolve profile:
      // Step A: First look up by exact login_id (case-insensitive) using the raw input or compact form
      let resolvedProfile: any = null;
      try {
        const { rows: loginRows } = await query(
          `SELECT id, email, identifier, login_id, role, is_disabled FROM public.profiles
           WHERE UPPER(TRIM(COALESCE(login_id, ''))) = $1
              OR UPPER(TRIM(COALESCE(login_id, ''))) = $2
           LIMIT 2`,
          [rawUpper, rawCompact]
        );

        if (loginRows.length === 1) {
          resolvedProfile = loginRows[0];
        } else if (loginRows.length > 1) {
          logger.warn('Ambiguous profile login_id rejected during login', { identityKey: rawUpper });
          await serverSleep(200);
          return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
        } else {
          // Step B: If not matched by login_id, look up by canonical identifier
          const { rows: idRows } = await query(
            `SELECT id, email, identifier, login_id, role, is_disabled FROM public.profiles
             WHERE UPPER(TRIM(identifier)) = $1
                OR UPPER(TRIM(identifier)) = $2
                OR UPPER(TRIM(identifier)) = $3
             LIMIT 2`,
            [canonicalKey, compactCanonical, rawUpper]
          );

          if (idRows.length === 1) {
            resolvedProfile = idRows[0];
          } else if (idRows.length > 1) {
            logger.warn('Ambiguous profile identifier rejected during login', { identityKey: canonicalKey });
            await serverSleep(200);
            return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
          }
        }
      } catch (dbErr) {
        logger.error('Database error during identifier profile lookup', { rawUpper, error: String(dbErr) });
        return Errors.INTERNAL('Database temporarily unavailable. Please retry.');
      }

      if (resolvedProfile) {
        if (resolvedProfile.is_disabled) {
          logger.warn('Login attempt for disabled profile by identifier rejected', { identityKey: resolvedProfile.identifier || rawUpper });
          await serverSleep(200);
          return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
        }

        identityKey = resolvedProfile.identifier || resolvedProfile.login_id || rawUpper;
        syntheticEmail = resolvedProfile.email || identifierToEmail(identityKey);
      } else if (normalized) {
        identityKey = normalized.canonical;
        syntheticEmail = identifierToEmail(identityKey);
      } else {
        logger.debug('Login attempt with invalid identifier format', {
          rawIdentifier: rawIdentifier.substring(0, 20),
        });
        await serverSleep(200);
        return NextResponse.json(
          { error: GENERIC_AUTH_ERROR },
          { status: 401 }
        );
      }
    }

    // ── Step 2: Layer 2 — Coarse endpoint rate limit ──
    const rawIp = extractClientIp(req.headers);
    const ipHash = hashClientIp(rawIp);

    if (!checkEndpointRateLimit(ipHash)) {
      logger.warn('Login rate limited (Layer 2)', { ipHash, identityKey });
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // ── Step 3: Layer 1 — Per-account progressive delay evaluation ──
    const throttle = await evaluateLoginThrottle(identityKey);

    // ── Step 4: Authenticate via GoTrue ──
    const supabase = createSupabaseAdminClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });

    const success = !authError && !!data?.user;
    const userAgent = req.headers.get('user-agent');

    // ── Step 5: Record telemetry (non-blocking) ──
    logLoginAttempt({
      identityKey,
      success,
      rawIp,
      rawUserAgent: userAgent,
    }).catch(() => {
      // Telemetry must never block authentication
    });

    // ── Step 6: Apply progressive delay ──
    if (throttle.delayMs > 0) {
      await serverSleep(throttle.delayMs);
    }

    // ── Step 7: Return result or enforce account status ──
    if (!success) {
      if (
        authError?.message?.toLowerCase().includes('rate limit') ||
        authError?.message?.toLowerCase().includes('too many requests')
      ) {
        logger.warn('Upstream authentication rate limit reached', { identityKey, ipHash });
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        );
      }

      logger.info('Login failed', { identityKey, ipHash });

      const response: Record<string, any> = {
        error: GENERIC_AUTH_ERROR,
      };

      // Include security notice for high-attempt counts (ADR-007)
      if (throttle.includeSecurityNotice) {
        response.security_notice =
          'Multiple failed login attempts detected. If you need help, please contact an organizer.';
      }

      return NextResponse.json(response, { status: 401 });
    }

    // ── Step 8: Authoritative Account Status & Identity Resolution ──
    // Resolve the authenticated Supabase Auth UUID to the corresponding canonical profile in Azure PostgreSQL.
    let authenticatedProfile: any = null;
    try {
      const { rows } = await query(
        `SELECT id, name, email, role, identifier, login_id, is_disabled, force_logout_before
         FROM public.profiles
         WHERE id = $1
         LIMIT 1`,
        [data.user!.id]
      );
      if (rows.length === 0) {
        logger.warn('Authenticated user has no corresponding profile in database', { userId: data.user!.id });
        return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
      }
      authenticatedProfile = rows[0];
    } catch (dbErr) {
      logger.error('Database error verifying account status for authenticated user', {
        userId: data.user!.id,
        error: String(dbErr),
      });
      // Fail closed if account status cannot be verified due to a database error
      return Errors.INTERNAL('Database temporarily unavailable. Please retry.');
    }

    // Reject disabled accounts before issuing or returning usable session tokens
    if (authenticatedProfile.is_disabled) {
      logger.warn('Login attempt for disabled account rejected after password authentication', {
        userId: data.user!.id,
        identifier: authenticatedProfile.identifier,
      });
      // Invalidate the session in GoTrue to ensure no usable session token survives
      try {
        if (data.session?.access_token) {
          await supabase.auth.admin.signOut(data.session.access_token);
        }
      } catch (signOutErr) {
        logger.warn('Failed to invalidate GoTrue session for disabled account', { error: String(signOutErr) });
      }
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // Verify identity alignment: do not let an email, identifier, or profile mismatch authenticate a different account
    if (
      authenticatedProfile.email &&
      data.user!.email &&
      authenticatedProfile.email.toLowerCase() !== data.user!.email.toLowerCase()
    ) {
      logger.error('Account identity conflict between Auth user and database profile', {
        authUserId: data.user!.id,
        authEmail: data.user!.email,
        profileEmail: authenticatedProfile.email,
      });
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // Active verified account: clear past force_logout_before to establish fresh session
    try {
      await query(
        'UPDATE public.profiles SET force_logout_before = NULL, updated_at = NOW() WHERE id = $1',
        [data.user!.id]
      );
    } catch (clearErr) {
      logger.warn('Failed to clear force_logout_before on successful login', {
        userId: data.user!.id,
        error: String(clearErr),
      });
    }

    // Log audit event
    logAudit({
      userId: data.user!.id,
      action: 'LOGIN_SUCCESS',
      details: { identifier: identityKey },
      rawIp,
      rawUserAgent: userAgent,
    }).catch(() => {});

    logger.info('Login successful', { identityKey, userId: data.user!.id });

    // ── Step 9: Atomic Team Concurrent Session Enforcement (Max 5 per team) ──
    const userTeamId = await getUserTeamId(data.user!.id);
    let assignedSessionId: string | undefined = undefined;

    if (userTeamId) {
      const incomingSessionId = body.session_id || req.cookies.get('cem_session_id')?.value;
      const tokenHash = data.session?.access_token
        ? crypto.createHash('sha256').update(data.session.access_token).digest('hex').substring(0, 32)
        : crypto.randomUUID();
      const finalSessionId = incomingSessionId || `sess_${tokenHash}`;
      assignedSessionId = finalSessionId;

      const sessionReg = await registerTeamSession({
        sessionId: finalSessionId,
        teamId: userTeamId,
        userId: data.user!.id,
        ipHash,
        userAgentSummary: summarizeUserAgent(userAgent),
        ttlSeconds: data.session?.expires_in || 86400,
      });

      if (!sessionReg.allowed) {
        // Invalidate GoTrue session so no usable session token survives
        try {
          if (data.session?.access_token) {
            await supabase.auth.admin.signOut(data.session.access_token);
          }
        } catch (signOutErr) {
          logger.warn('Failed to invalidate GoTrue session on session-limit rejection', {
            error: String(signOutErr),
          });
        }

        return NextResponse.json(
          {
            error: sessionReg.message || 'Team concurrent session limit reached.',
            code: sessionReg.reason || 'TEAM_SESSION_LIMIT_EXCEEDED',
            active_count: sessionReg.activeCount,
            max_allowed: TEAM_MAX_CONCURRENT_SESSIONS,
          },
          { status: 429 }
        );
      }
    }

    // Set server-side session cookies so the client never needs client-side Supabase keys
    if (data.session?.access_token && data.session?.refresh_token) {
      try {
        const serverSupabase = await createSupabaseServerClient();
        await serverSupabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      } catch (sessErr) {
        logger.warn('Failed setting server-side session cookies on login', { error: String(sessErr) });
      }
    }

    const responseObj = successResponse({
      user: {
        id: data.user!.id,
        email: data.user!.email,
        identifier: identityKey,
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
        session_id: assignedSessionId,
      },
    });

    try {
      const cookieStore = await cookies();
      cookieStore.getAll().forEach((c) => {
        responseObj.cookies.set(c.name, c.value);
      });
    } catch (_) {}

    if (assignedSessionId) {
      responseObj.cookies.set('cem_session_id', assignedSessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 86400,
      });
    }

    return responseObj;
  } catch (err) {
    logger.error('Login endpoint unexpected error', { error: String(err) });
    return Errors.INTERNAL();
  }
}

