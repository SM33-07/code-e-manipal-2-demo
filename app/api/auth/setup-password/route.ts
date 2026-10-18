import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isDemoMode, assertDemoModeSafety } from '@/lib/demo/demoMode';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/auth/setup-password
 *
 * Records secure completion of recipient password setup.
 * Zero plaintext passwords accepted or stored.
 */
export async function POST(req: NextRequest) {
  try {
    // ── Demo Mode Read-Only Guard ──
    if (isDemoMode()) {
      assertDemoModeSafety();
      return Errors.FORBIDDEN('Demo Mode Active: Password setup is disabled in this read-only showcase.');
    }

    const supabase = await createSupabaseServerClient();
    
    // Support both cookie-based auth and bearer token header fallback
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let user = null;
    if (bearerToken) {
      const { data } = await supabase.auth.getUser(bearerToken);
      user = data.user;
    } else {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user || !user.email) {
      return Errors.UNAUTHORIZED('Authentication required to record password setup.');
    }

    // Verify profile in Azure PostgreSQL
    const { rows } = await query(
      'SELECT id, role, identifier FROM public.profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );

    const profile = rows[0];
    if (!profile) {
      return Errors.NOT_FOUND('Profile not found.');
    }

    // Clear force_logout_before so the user's fresh session remains active
    await query(
      'UPDATE public.profiles SET force_logout_before = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Record immutable audit event
    await query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, 'USER_PASSWORD_SETUP_COMPLETED', 'profiles', $1, $2)`,
      [
        user.id,
        JSON.stringify({
          email: user.email,
          role: profile.role,
          identifier: profile.identifier,
          completed_at: new Date().toISOString(),
        }),
      ]
    );

    logger.info('User completed secure password setup', { userId: user.id, email: user.email, role: profile.role });

    return successResponse({ message: 'Password setup finalized.' });
  } catch (error) {
    logger.error('POST /api/auth/setup-password failed', { error: String(error) });
    return Errors.INTERNAL('Failed to finalize password setup.');
  }
}
