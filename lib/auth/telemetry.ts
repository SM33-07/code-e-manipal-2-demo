import crypto from 'crypto';
import { query } from '../db';

/**
 * Generates a privacy-minimized 16-hex-character IP hash.
 * Uses HMAC-SHA256 with a daily rotating salt or server seed.
 * Raw IP addresses are NEVER persisted.
 */
export function hashClientIp(rawIp: string): string {
  if (!rawIp || rawIp === 'unknown') {
    return '0000000000000000';
  }

  // Daily rotating salt component (YYYY-MM-DD) combined with server secret
  const dateStr = new Date().toISOString().split('T')[0];
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DATABASE_URL || 'cem-default-telemetry-salt';
  const secretKey = `${salt}:${dateStr}`;

  return crypto
    .createHmac('sha256', secretKey)
    .update(rawIp.trim())
    .digest('hex')
    .slice(0, 16);
}

/**
 * Normalizes User-Agent to browser family and platform (max 64 chars).
 * Raw User-Agent strings are discarded to minimize fingerprinting.
 */
export function summarizeUserAgent(rawUserAgent?: string | null): string {
  if (!rawUserAgent) return 'Unknown/Unknown';

  const ua = rawUserAgent;
  let browser = 'Other';
  let os = 'Other';

  // OS detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  // Browser detection
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  const summary = `${browser}/${os}`;
  return summary.slice(0, 64);
}

/**
 * Extracts client IP from standard reverse-proxy headers (Cloudflare, Vercel, x-forwarded-for).
 */
export function extractClientIp(headers: Headers): string {
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.split(',')[0].trim();

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp.split(',')[0].trim();

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();

  return '127.0.0.1';
}

/**
 * Logs a privacy-minimized authentication attempt to public.login_attempts
 */
export async function logLoginAttempt(params: {
  identityKey: string;
  success: boolean;
  rawIp: string;
  rawUserAgent?: string | null;
}) {
  try {
    const ipHash = hashClientIp(params.rawIp);
    const uaSummary = summarizeUserAgent(params.rawUserAgent);

    await query(
      `INSERT INTO public.login_attempts (identity_key, attempted_at, success, ip_hash, user_agent_summary)
       VALUES ($1, NOW(), $2, $3, $4)`,
      [params.identityKey, params.success, ipHash, uaSummary]
    );
  } catch (err) {
    // Non-blocking telemetry error logging
    console.error('Failed to log login attempt telemetry:', err);
  }
}

/**
 * Appends a security audit log record to public.audit_logs (append-only)
 */
export async function logAudit(params: {
  userId?: string | null;
  action: string;
  targetTable?: string;
  targetId?: string;
  details?: Record<string, any>;
  rawIp?: string;
  rawUserAgent?: string | null;
}) {
  try {
    const ipHash = params.rawIp ? hashClientIp(params.rawIp) : null;
    const uaSummary = params.rawUserAgent ? summarizeUserAgent(params.rawUserAgent) : null;

    await query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details, ip_hash, user_agent_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.userId || null,
        params.action,
        params.targetTable || null,
        params.targetId || null,
        JSON.stringify(params.details || {}),
        ipHash,
        uaSummary,
      ]
    );
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}
