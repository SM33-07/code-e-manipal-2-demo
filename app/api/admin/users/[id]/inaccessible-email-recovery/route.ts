import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { Errors, successResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/validate';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSetupPasswordRedirectUrl } from '@/lib/auth/siteUrl';
import { logger } from '@/lib/utils/logger';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/users/:id/inaccessible-email-recovery
 * Admin only — Secure fallback for participants who cannot access their registered email.
 *
 * Security Controls:
 * - Only participants can have email updated via fallback (admins & judges strictly prohibited)
 * - Mandatory verification notes (minimum 10 chars)
 * - Email format and collision validation
 * - Invalidation of all existing active sessions
 * - Full audit trail with initiating admin, old email, replacement email, reason
 * - Zero tokens or passwords exposed
 */
export const POST = withAuth(async (req, { user: adminUser, params }) => {
  try {
    const targetUserId = params?.id;
    if (!targetUserId || !isValidUUID(targetUserId)) {
      return Errors.BAD_REQUEST('Invalid target user ID');
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid request body.');
    }

    const replacementEmail = (body.replacement_email || '').trim().toLowerCase();
    const reason = (body.reason || '').trim();

    if (!replacementEmail || !EMAIL_REGEX.test(replacementEmail)) {
      return Errors.BAD_REQUEST('A valid replacement email address is required.');
    }

    if (!reason || reason.length < 10) {
      return Errors.BAD_REQUEST('A detailed verification reason (at least 10 characters) is required for audit compliance.');
    }

    // 1. Verify target profile exists
    const { rows } = await query(
      'SELECT id, name, email, role, identifier, is_disabled FROM public.profiles WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (rows.length === 0) {
      return Errors.NOT_FOUND('User profile');
    }

    const targetUser = rows[0];

    // Security Gate: Fallback recovery is strictly restricted to participants
    if (targetUser.role !== 'participant') {
      logger.warn('Attempted email recovery fallback on non-participant rejected', {
        adminId: adminUser.id,
        targetUserId,
        targetRole: targetUser.role,
      });
      return Errors.FORBIDDEN('Inaccessible-email fallback is strictly restricted to participant accounts. Administrative account recovery must follow identity governance procedures.');
    }

    if (targetUser.is_disabled) {
      return Errors.BAD_REQUEST('Cannot initiate recovery for a disabled account.');
    }

    if (targetUser.email.toLowerCase() === replacementEmail) {
      return Errors.BAD_REQUEST('Replacement email is identical to current registered email.');
    }

    // 2. Check collision in public.profiles
    const { rows: collisionRows } = await query(
      'SELECT id FROM public.profiles WHERE LOWER(email) = $1 AND id != $2 LIMIT 1',
      [replacementEmail, targetUserId]
    );
    if (collisionRows.length > 0) {
      return Errors.BAD_REQUEST('Replacement email is already associated with another existing account.');
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 3. Update email in Supabase Auth
    const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      email: replacementEmail,
      email_confirm: true,
    });

    if (authUpdateErr) {
      logger.error('Failed to update email in Supabase Auth', {
        targetUserId,
        error: authUpdateErr.message,
      });
      return Errors.INTERNAL(`Auth update failed: ${authUpdateErr.message}`);
    }

    // 4. Update email in Azure PostgreSQL profiles & registrations
    await query('BEGIN');
    try {
      await query(
        'UPDATE public.profiles SET email = $1, force_logout_before = NOW(), updated_at = NOW() WHERE id = $2',
        [replacementEmail, targetUserId]
      );

      // Also update hackathon_registrations if existing
      await query(
        'UPDATE public.hackathon_registrations SET email = $1, updated_at = NOW() WHERE email = $2',
        [replacementEmail, targetUser.email]
      );

      // Also mirror in auth.users shadow table if exists
      await query(
        'UPDATE auth.users SET email = $1 WHERE id = $2',
        [replacementEmail, targetUserId]
      ).catch(() => {});

      // 5. Append audit log
      await query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'PARTICIPANT_INACCESSIBLE_EMAIL_RECOVERY', 'profiles', $2, $3)`,
        [
          adminUser.id,
          targetUserId,
          JSON.stringify({
            target_identifier: targetUser.identifier,
            previous_email: targetUser.email,
            replacement_email: replacementEmail,
            reason,
            sessions_revoked: true,
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      await query('COMMIT');
    } catch (dbErr: any) {
      await query('ROLLBACK');
      logger.error('Failed to update profile email in database', { error: dbErr.message });
      return Errors.INTERNAL('Failed to commit profile email update in database.');
    }

    // 6. Dispatch recovery email to replacement email
    const redirectTo = getSetupPasswordRedirectUrl();
    const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(replacementEmail, {
      redirectTo,
    });

    if (resetErr) {
      logger.warn('Password recovery note after email update', { error: resetErr.message });
    }

    logger.info('Participant email recovery successfully initiated', {
      adminId: adminUser.id,
      targetUserId,
      oldEmail: targetUser.email,
      replacementEmail,
    });

    return successResponse({
      message: `Account email updated to ${replacementEmail} and password setup link dispatched. Previous sessions revoked.`,
    });
  } catch (error: any) {
    logger.error('POST /api/admin/users/:id/inaccessible-email-recovery failed', { error: String(error) });
    return Errors.INTERNAL('Failed to initiate inaccessible email recovery.');
  }
});
