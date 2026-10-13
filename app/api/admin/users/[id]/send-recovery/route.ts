import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { Errors, successResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/validate';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSetupPasswordRedirectUrl } from '@/lib/auth/siteUrl';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/users/:id/send-recovery
 * Admin only — Dispatches official password reset link to user's registered email.
 */
export const POST = withAuth(async (req, { user: adminUser, params }) => {
  try {
    const targetUserId = params?.id;
    if (!targetUserId || !isValidUUID(targetUserId)) {
      return Errors.BAD_REQUEST('Invalid target user ID');
    }

    // 1. Verify target user exists
    const { rows } = await query(
      'SELECT id, name, email, role, identifier, is_disabled FROM public.profiles WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (rows.length === 0) {
      return Errors.NOT_FOUND('User profile');
    }

    const targetUser = rows[0];
    if (targetUser.is_disabled) {
      return Errors.BAD_REQUEST('Cannot send password recovery to a disabled account.');
    }

    const redirectTo = getSetupPasswordRedirectUrl();
    const supabaseAdmin = createSupabaseAdminClient();

    // 2. Dispatch recovery email via Supabase Auth
    const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(targetUser.email, {
      redirectTo,
    });

    if (resetErr) {
      logger.error('Failed to trigger resetPasswordForEmail for user', {
        targetUserId,
        error: resetErr.message,
      });
      return Errors.INTERNAL(`Auth provider error: ${resetErr.message}`);
    }

    // 3. Record immutable audit event
    await query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, 'ADMIN_DISPATCHED_PASSWORD_RECOVERY', 'profiles', $2, $3)`,
      [
        adminUser.id,
        targetUserId,
        JSON.stringify({
          target_email: targetUser.email,
          target_role: targetUser.role,
          target_identifier: targetUser.identifier,
          delivery_channel: 'supabase-mailer',
          redirect_url: redirectTo,
          dispatched_at: new Date().toISOString(),
        }),
      ]
    );

    logger.info('Admin dispatched password recovery email', {
      adminId: adminUser.id,
      targetUserId,
      targetEmail: targetUser.email,
    });

    return successResponse({
      message: `Password reset instructions dispatched to ${targetUser.email}.`,
    });
  } catch (error: any) {
    logger.error('POST /api/admin/users/:id/send-recovery failed', { error: String(error) });
    return Errors.INTERNAL('Failed to send recovery instructions.');
  }
});
