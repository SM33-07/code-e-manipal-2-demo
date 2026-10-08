/**
 * Defense-in-Depth Login Throttling & Campus-NAT-Safe Rate Limiting
 *
 * Per ADR-007:
 *
 * Layer 1: Per-Account Progressive Delay (Primary Anti-Brute-Force Control)
 *   - Rolling 15-minute window per canonical identifier
 *   - Attempts 1–3: 0ms delay (instantaneous)
 *   - Attempts 4–5: 1,000ms server-side sleep
 *   - Attempts 6–10: 3,000ms server-side sleep + security notice
 *   - Attempts 11+: 5,000ms server-side sleep
 *   - NO hard lockout (prevents DoS against legitimate teams)
 *
 * Layer 2: Campus-NAT-Safe Coarse IP/Endpoint Rate Limiter
 *   - Token-bucket burst limiter on /api/auth/login
 *   - Thresholds calibrated for 50-100 teams behind shared campus NAT
 *   - Configurable, not hardcoded to low limits
 */

import { query } from '@/lib/db';
import { logger } from '@/lib/utils/logger';

/** Rolling window for per-account attempt counting */
const ROLLING_WINDOW_MINUTES = 15;

/** Progressive delay tiers (ADR-007) */
const DELAY_TIERS = [
  { maxAttempts: 3, delayMs: 0 },
  { maxAttempts: 5, delayMs: 1_000 },
  { maxAttempts: 10, delayMs: 3_000 },
  { maxAttempts: Infinity, delayMs: 5_000 },
] as const;

/** Security notice threshold — attempts ≥ this trigger a notice in the response.
 * Note: Since evaluateLoginThrottle runs before recording the current failed attempt,
 * 5 prior failures in the rolling window means this is attempt 6.
 */
const SECURITY_NOTICE_THRESHOLD = 5;

export interface ThrottleResult {
  /** Milliseconds the server should sleep before responding */
  delayMs: number;
  /** Number of failed attempts in the current rolling window */
  recentFailures: number;
  /** Whether to include a security notice in the response payload */
  includeSecurityNotice: boolean;
}

/**
 * Evaluates the progressive delay for a given canonical identifier
 * based on recent failed login attempts in the rolling window.
 *
 * This is non-blocking to the database — it only reads the count.
 * The actual server-side sleep is performed by the caller.
 *
 * @param identityKey - The canonical identifier (e.g., "TEAM-042")
 * @returns ThrottleResult with delay and notice requirements
 */
export async function evaluateLoginThrottle(identityKey: string): Promise<ThrottleResult> {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS fail_count
       FROM public.login_attempts
       WHERE identity_key = $1
         AND success = false
         AND attempted_at > NOW() - INTERVAL '${ROLLING_WINDOW_MINUTES} minutes'`,
      [identityKey]
    );

    const recentFailures = rows[0]?.fail_count ?? 0;

    // Determine delay tier
    let delayMs = 0;
    for (const tier of DELAY_TIERS) {
      if (recentFailures < tier.maxAttempts) {
        delayMs = tier.delayMs;
        break;
      }
      delayMs = tier.delayMs;
    }

    return {
      delayMs,
      recentFailures,
      includeSecurityNotice: recentFailures >= SECURITY_NOTICE_THRESHOLD,
    };
  } catch (err) {
    logger.error('Login throttle evaluation failed, defaulting to no delay', {
      identityKey,
      error: String(err),
    });
    // Fail-open for throttle check (we don't want to block legitimate users
    // if the login_attempts table is temporarily unreachable)
    return { delayMs: 0, recentFailures: 0, includeSecurityNotice: false };
  }
}

/**
 * Server-side sleep implementation for progressive delay.
 * This is intentionally blocking to slow down brute-force attempts.
 */
export function serverSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────
// Layer 2: Campus-NAT-Safe Coarse Token-Bucket Rate Limiter
// ────────────────────────────────────────────────────────

/**
 * In-memory token bucket for coarse endpoint rate limiting.
 * Designed to be calibrated for campus NAT environments where
 * 50-100 teams may share a single IP.
 *
 * NOTE: In a multi-instance deployment (e.g., Vercel serverless),
 * each instance maintains its own bucket. This is acceptable because:
 * 1. It's a defense-in-depth measure, not a primary control
 * 2. Per-account throttling (Layer 1) is the primary defense
 * 3. The bucket resets naturally on cold starts
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

/**
 * Campus-NAT-calibrated rate limit defaults.
 *
 * These are intentionally generous to accommodate legitimate
 * burst traffic from shared campus Wi-Fi NAT:
 * - 200 requests per minute per IP hash (allows ~3-4 attempts per team
 *   when 50-100 teams share a single NAT IP)
 * - Burst capacity of 50 (absorbs initial login surge)
 */
const RATE_LIMIT_CONFIG = {
  maxTokens: 200,       // Max tokens (requests) per refill window
  refillRatePerSec: 4,  // ~200 per minute = ~3.3 per second
  burstCapacity: 50,    // Initial burst allowance
} as const;

/**
 * Check if a request is within the coarse rate limit.
 * Uses a token-bucket algorithm keyed by IP hash.
 *
 * @param ipHash - The privacy-minimized IP hash
 * @returns true if the request is allowed, false if rate-limited
 */
export function checkEndpointRateLimit(ipHash: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ipHash);

  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_CONFIG.burstCapacity, lastRefill: now };
    buckets.set(ipHash, bucket);
    // Periodic cleanup of stale buckets (prevent memory leak in long-running processes)
    if (buckets.size > 10_000) {
      cleanupStaleBuckets(now);
    }
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  const refill = elapsed * RATE_LIMIT_CONFIG.refillRatePerSec;
  bucket.tokens = Math.min(RATE_LIMIT_CONFIG.maxTokens, bucket.tokens + refill);
  bucket.lastRefill = now;

  // Consume a token
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  logger.warn('Endpoint rate limit exceeded', { ipHash });
  return false;
}

/**
 * Clean up token buckets that haven't been accessed in 5+ minutes.
 */
function cleanupStaleBuckets(now: number): void {
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > staleThreshold) {
      buckets.delete(key);
    }
  }
}

/**
 * Reset the failed attempt counter for an account.
 * Called by admins via /admin/users to instantly clear throttling.
 *
 * @param identityKey - The canonical identifier to reset
 */
export async function resetLoginThrottle(identityKey: string): Promise<void> {
  try {
    await query(
      `DELETE FROM public.login_attempts
       WHERE identity_key = $1
         AND success = false
         AND attempted_at > NOW() - INTERVAL '${ROLLING_WINDOW_MINUTES} minutes'`,
      [identityKey]
    );
    logger.info('Login throttle reset for account', { identityKey });
  } catch (err) {
    logger.error('Failed to reset login throttle', {
      identityKey,
      error: String(err),
    });
  }
}
