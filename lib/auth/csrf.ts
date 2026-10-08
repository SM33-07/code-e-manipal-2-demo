/**
 * CSRF Protection Strategy (Cookie-Based Session Security)
 *
 * Per ADR-007 & Phase 2 specification:
 *
 * Request Classification:
 * - Browser Mutations (Cookie-Authenticated): All state-changing endpoints
 *   (POST, PUT, PATCH, DELETE) inspect Origin and Referer headers against
 *   an approved production/staging origin allowlist. Mismatches return 403.
 *
 * - Trusted Server-to-Server / Worker Requests: Internal cron or background
 *   worker requests authenticate via pre-shared secret header (x-internal-secret),
 *   bypassing browser Origin validation.
 *
 * Explicit Rule: CORS configuration is NOT considered sufficient for CSRF protection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

/** HTTP methods that require CSRF validation (state-changing) */
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Build the approved origin allowlist from environment.
 * Includes production domain, staging, and localhost for development.
 */
function getApprovedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Production origins
  origins.add('https://codeemanipal.in');
  origins.add('https://www.codeemanipal.in');
  origins.add('https://portal.codeemanipal.in');

  // From environment (e.g., Vercel preview deployments, custom app URLs)
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envOrigin) {
    try {
      const url = new URL(envOrigin);
      origins.add(url.origin);
    } catch {
      // Ignore malformed env
    }
  }

  // Localhost / loopback origins (supported for local development, testing, and production builds)
  origins.add('http://localhost:3000');
  origins.add('http://localhost:3001');
  origins.add('http://localhost:3002');
  origins.add('http://127.0.0.1:3000');
  origins.add('http://127.0.0.1:3001');
  origins.add('http://127.0.0.1:3002');

  return origins;
}

/**
 * Check if the request's origin matches the server host (Same-Origin).
 */
function isSameOrigin(req: NextRequest, requestOrigin: string): boolean {
  if (req.nextUrl.origin && requestOrigin === req.nextUrl.origin) {
    return true;
  }
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '') || 'http';
  if (host) {
    if (
      requestOrigin === `${proto}://${host}` ||
      requestOrigin === `http://${host}` ||
      requestOrigin === `https://${host}`
    ) {
      return true;
    }
  }
  return false;
}

/** Cached allowlist (computed once per cold start) */
let _approvedOrigins: Set<string> | null = null;
function approvedOrigins(): Set<string> {
  if (!_approvedOrigins) {
    _approvedOrigins = getApprovedOrigins();
  }
  return _approvedOrigins;
}

/**
 * Extract the origin from the request's Origin or Referer header.
 * Origin is preferred; Referer is a fallback (stripped to origin).
 */
function extractRequestOrigin(req: NextRequest): string | null {
  const origin = req.headers.get('origin');
  if (origin) return origin;

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Check if a request is a trusted internal/worker request.
 *
 * Internal requests authenticate via x-internal-secret header
 * matching the server's INTERNAL_SECRET environment variable.
 * These bypass browser Origin validation entirely.
 */
function isTrustedInternalRequest(req: NextRequest): boolean {
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret) return false;

  const headerValue = req.headers.get('x-internal-secret');
  if (!headerValue) return false;

  // Constant-time comparison to prevent timing attacks
  if (headerValue.length !== internalSecret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < internalSecret.length; i++) {
    mismatch |= headerValue.charCodeAt(i) ^ internalSecret.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Validates CSRF protection for a request.
 *
 * Returns null if the request passes CSRF validation.
 * Returns a 403 NextResponse if the request fails CSRF validation.
 *
 * Rules:
 * 1. GET/HEAD/OPTIONS requests are exempt (read-only).
 * 2. Trusted internal requests (x-internal-secret) are exempt.
 * 3. All other state-changing requests must have a matching Origin/Referer.
 */
export function validateCsrf(req: NextRequest): NextResponse | null {
  // Rule 1: Read-only methods are exempt
  if (!CSRF_METHODS.has(req.method)) {
    return null;
  }

  // Rule 2: Trusted internal/worker requests bypass Origin validation
  if (isTrustedInternalRequest(req)) {
    return null;
  }

  // Rule 3: Validate Origin/Referer against allowlist
  const requestOrigin = extractRequestOrigin(req);

  if (!requestOrigin) {
    logger.warn('CSRF: Mutation request with no Origin or Referer header', {
      method: req.method,
      url: req.nextUrl.pathname,
    });
    return Errors.FORBIDDEN() as NextResponse;
  }

  const isAllowed =
    isSameOrigin(req, requestOrigin) ||
    approvedOrigins().has(requestOrigin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin);

  if (!isAllowed) {
    logger.warn('CSRF: Origin not in approved allowlist', {
      method: req.method,
      url: req.nextUrl.pathname,
      origin: requestOrigin,
    });
    return Errors.FORBIDDEN() as NextResponse;
  }

  return null;
}

/**
 * Recommended SameSite cookie settings for production.
 * These should be applied to session cookies via Supabase config.
 */
export const COOKIE_SECURITY_DEFAULTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
} as const;
