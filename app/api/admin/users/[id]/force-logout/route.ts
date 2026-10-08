import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { Errors, successResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/validate';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/users/:id/force-logout
 * Admin only — Immediate force logout and session invalidation.
 *
 * Implements Phase 2 session lifecycle invariant:
 * - Updates profiles.force_logout_before = NOW()
 * - Triggers Supabase GoTrue session revocation
 * - Subsequent API requests with old tokens immediately fail with 401 Unauthorized
 * - Appends audit log entry
 */
export const POST = withAuth(async (req, { user: adminUser, params }) => {
  try {
    const targetUserId = params?.id;
    if (!targetUserId || !isValidUUID(targetUserId)) {
      return Errors.BAD_REQUEST('Invalid target user ID');
    }

    // 1. Verify user exists
    const { rows: profileRows } = await query(
      'SELECT id, email, role FROM public.profiles WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (profileRows.length === 0) {
      return Errors.NOT_FOUND('User profile');
    }

    const targetUser = profileRows[0];

    // 2. Set force_logout_before = NOW() in Azure Postgres profiles (Phase 2 authority)
    await query(
      'UPDATE public.profiles SET force_logout_before = NOW(), updated_at = NOW() WHERE id = $1',
      [targetUserId]
    );

    // 3. Revoke GoTrue sessions via Supabase Admin API
    try {
      const supabase = createSupabaseAdminClient();
      await supabase.auth.admin.signOut(targetUserId);
    } catch (e) {
      logger.warn('Supabase GoTrue signOut warning (profiles.force_logout_before is primary authority)', {
        error: String(e),
      });
    }

    // 4. Record security audit log
    let reason = 'Admin force logout';
    try {
      const body = await req.json();
      if (body?.reason) reason = String(body.reason).trim();
    } catch {
      // Body optional
    }

    await query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminUser.id,
        'USER_FORCE_LOGOUT',
        'profiles',
        targetUserId,
        JSON.stringify({
          target_email: targetUser.email,
          target_role: targetUser.role,
          reason,
        }),
      ]
    );

    logger.info('Admin forced logout on user', {
      adminId: adminUser.id,
      targetUserId,
    });

    return successResponse({
      message: 'User sessions successfully invalidated. Next request from this user will be rejected.',
      user_id: targetUserId,
    });
  } catch (err) {
    logger.error('POST /api/admin/users/[id]/force-logout', {
      error: err instanceof Error ? err.message : String(err),
    });
    return Errors.INTERNAL();
  }
}, 'admin');
