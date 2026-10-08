/**
 * POST /api/auth/logout
 *
 * Session Lifecycle — Normal Logout
 *
 * Per Phase 2 specification:
 * - Clears client HTTP-only session cookie
 * - Revokes session in Supabase GoTrue
 * - Records audit log entry
 */

import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { validateCsrf } from '@/lib/auth/csrf';
import { logAudit, extractClientIp } from '@/lib/auth/telemetry';
import { logger } from '@/lib/utils/logger';
import { successResponse, Errors } from '@/lib/utils/response';

export async function POST(req: NextRequest) {
  try {
    // CSRF validation (browser mutation)
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    const supabase = await createSupabaseServerClient();

    // Get current user before signing out (for audit log)
    const { data: { user } } = await supabase.auth.getUser();

    // Revoke session in GoTrue
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.warn('Logout: GoTrue signOut returned error', {
        error: error.message,
        userId: user?.id,
      });
      // Continue anyway — the goal is to clear the session
    }

    // Record audit log (non-blocking)
    if (user) {
      logAudit({
        userId: user.id,
        action: 'LOGOUT',
        rawIp: extractClientIp(req.headers),
        rawUserAgent: req.headers.get('user-agent'),
      }).catch(() => {});
    }

    logger.info('Logout successful', { userId: user?.id });

    return successResponse({ message: 'Logged out successfully.' });
  } catch (err) {
    logger.error('Logout endpoint unexpected error', { error: String(err) });
    return Errors.INTERNAL();
  }
}
