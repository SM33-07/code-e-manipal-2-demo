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

import { query } from '@/lib/db';

/** Generic error message for enumeration resistance (ADR-007) */
const GENERIC_AUTH_ERROR = 'Invalid identifier or password.';

export async function POST(req: NextRequest) {
  try {
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
    } else {
      const normalized = normalizeIdentifier(trimmedInput);
      const normalizedLogin = normalizeLoginId(trimmedInput);
      identityKey = normalized?.canonical || normalizedLogin?.canonical || trimmedInput.toUpperCase();

      // Look up the authoritative email from Azure profiles using either the
      // canonical identifier or the separate personalized login_id.
      let profileEmail: string | null = null;
      try {
        const { rows } = await query(
          `SELECT email FROM public.profiles
           WHERE UPPER(identifier) = UPPER($1)
              OR UPPER(login_id) = UPPER($1)
           LIMIT 2`,
          [identityKey]
        );
        if (rows.length > 1) {
          logger.warn('Ambiguous profile identifier rejected during login', { identityKey });
          await serverSleep(200);
          return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
        }
        if (rows.length === 1 && rows[0].email) {
          profileEmail = rows[0].email;
        }
      } catch (dbErr) {
        logger.warn('Failed to query profile for identifier', { identityKey, error: String(dbErr) });
      }

      if (profileEmail) {
        syntheticEmail = profileEmail;
      } else if (normalized) {
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

    // ── Step 7: Return result ──
    if (!success) {
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

    // Success — log audit event
    logAudit({
      userId: data.user!.id,
      action: 'LOGIN_SUCCESS',
      details: { identifier: identityKey },
      rawIp,
      rawUserAgent: userAgent,
    }).catch(() => {});

    logger.info('Login successful', { identityKey, userId: data.user!.id });

    return successResponse({
      user: {
        id: data.user!.id,
        email: data.user!.email,
        identifier: identityKey,
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      },
    });
  } catch (err) {
    logger.error('Login endpoint unexpected error', { error: String(err) });
    return Errors.INTERNAL();
  }
}
