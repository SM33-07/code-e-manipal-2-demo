import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { Errors, successResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/validate';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateEventPassword, generateAdminPassword } from '@/lib/admin/credentials';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/users/:id/reset-password
 * Admin only — Single-click password reset with session invalidation.
 *
 * Security Requirements:
 * - Single-click execution under 60 seconds
 * - Immediate session revocation: sets force_logout_before = NOW()
 * - Zero Plaintext Persistence: password returned once in response, never stored in DB
 * - Zero Telemetry Leakage: password never logged in application logs or audit logs
 * - Cache-Control: no-store headers on response
 */
export const POST = withAuth(async (req, { user: adminUser, params }) => {
  try {
    const targetUserId = params?.id;
    if (!targetUserId || !isValidUUID(targetUserId)) {
      return Errors.BAD_REQUEST('Invalid target user ID');
    }

    // 1. Verify user exists
    const { rows: profileRows } = await query(
      'SELECT id, name, email, role, is_disabled FROM public.profiles WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (profileRows.length === 0) {
      return Errors.NOT_FOUND('User profile');
    }

    const targetUser = profileRows[0];

    // 2. Parse optional request body for custom password
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is valid (triggers auto-generation)
    }

    let newPassword = typeof body.password === 'string' ? body.password.trim() : null;

    if (newPassword) {
      if (targetUser.role === 'admin' && newPassword.length < 16) {
        return Errors.BAD_REQUEST('Admin passwords must be at least 16 characters in length');
      }
      if (newPassword.length < 6) {
        return Errors.BAD_REQUEST('Password must be at least 6 characters in length');
      }
    } else {
      // Auto-generate based on role separation
      newPassword = targetUser.role === 'admin'
        ? generateAdminPassword(18)
        : generateEventPassword(8);
    }

    // 3. Update password in Supabase Auth (hashed via bcrypt)
    const supabase = createSupabaseAdminClient();
    const { error: authError } = await supabase.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (authError) {
      logger.error('Failed to update user password in Supabase Auth', {
        targetUserId,
        error: authError.message,
      });
      return Errors.INTERNAL('Failed to update user password in authentication provider');
    }

    // 4. Invalidate all active sessions via force_logout_before = NOW() (Phase 2 integration)
    await query(
      'UPDATE public.profiles SET force_logout_before = NOW(), updated_at = NOW() WHERE id = $1',
      [targetUserId]
    );

    // 5. Append security audit log (ZERO plaintext password in details)
    await query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminUser.id,
        'USER_PASSWORD_RESET',
        'profiles',
        targetUserId,
        JSON.stringify({
          target_email: targetUser.email,
          target_role: targetUser.role,
          sessions_revoked: true,
          reason: body.reason || 'Admin password reset',
        }),
      ]
    );

    logger.info('Admin reset user password and revoked active sessions', {
      adminId: adminUser.id,
      targetUserId,
    });

    // 6. Return response with non-cached headers
    const response = successResponse(
      {
        message: 'Password reset successfully. All active sessions have been invalidated.',
        temporary_password: newPassword, // Returned ONCE to administrator
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
      },
      { cache: 'no-store' }
    );

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (err) {
    logger.error('POST /api/admin/users/[id]/reset-password', {
      error: err instanceof Error ? err.message : String(err),
    });
    return Errors.INTERNAL();
  }
}, 'admin');
