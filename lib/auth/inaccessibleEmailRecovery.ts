/**
 * Code-e-Manipal 2.0 — Inaccessible Email Recovery Service
 *
 * Implements failure-safe email recovery for participants who cannot access
 * their registered mailbox. Provides:
 * 1. Preflight identity, role, and collision validation
 * 2. Pre-mutation state capture
 * 3. Atomic database profile, registration, and audit update
 * 4. Automatic compensation with verification if DB transaction fails
 * 5. Sanitized critical reconciliation event on compensation failure
 * 6. Protection against concurrent races via optimistic row matching
 */

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const logger = {
  info: (msg: string, meta?: any) =>
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: msg, ...(meta && { meta }) })),
  warn: (msg: string, meta?: any) =>
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', message: msg, ...(meta && { meta }) })),
  error: (msg: string, meta?: any) =>
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', message: msg, ...(meta && { meta }) })),
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InaccessibleEmailRecoveryOptions {
  targetUserId?: string;
  replacementEmail?: string;
  reason?: string;
  adminUserId: string;
  dbQuery: (text: string, params?: any[]) => Promise<any>;
  supabaseAdmin: any;
  redirectTo?: string;
}

export interface InaccessibleEmailRecoveryResult {
  success: boolean;
  status: number;
  error?: string;
  message?: string;
  warning?: string;
  reconciliationRequired?: boolean;
}

export async function executeInaccessibleEmailRecovery(
  options: InaccessibleEmailRecoveryOptions
): Promise<InaccessibleEmailRecoveryResult> {
  const {
    targetUserId,
    reason,
    adminUserId,
    dbQuery,
    supabaseAdmin,
    redirectTo = 'https://code-e-manipal-portal.vercel.app/auth/setup-password',
  } = options;

  if (!targetUserId || !isValidUUID(targetUserId)) {
    return { success: false, status: 400, error: 'Invalid target user ID' };
  }

  const replacementEmail = (options.replacementEmail || '').trim().toLowerCase();
  const trimmedReason = (reason || '').trim();

  if (!replacementEmail || !EMAIL_REGEX.test(replacementEmail)) {
    return { success: false, status: 400, error: 'A valid replacement email address is required.' };
  }

  if (!trimmedReason || trimmedReason.length < 10) {
    return {
      success: false,
      status: 400,
      error: 'A detailed verification reason (at least 10 characters) is required for audit compliance.',
    };
  }

  // 1. Verify target profile exists in database
  const { rows } = await dbQuery(
    'SELECT id, name, email, role, identifier, is_disabled FROM public.profiles WHERE id = $1 LIMIT 1',
    [targetUserId]
  );

  if (!rows || rows.length === 0) {
    return { success: false, status: 404, error: 'User profile' };
  }

  const targetUser = rows[0];

  // Security Gate: strictly restricted to participants
  if (targetUser.role !== 'participant') {
    logger.warn('Attempted email recovery fallback on non-participant rejected', {
      adminId: adminUserId,
      targetUserId,
      targetRole: targetUser.role,
    });
    return {
      success: false,
      status: 403,
      error: 'Inaccessible-email fallback is strictly restricted to participant accounts. Administrative account recovery must follow identity governance procedures.',
    };
  }

  if (targetUser.is_disabled) {
    return { success: false, status: 400, error: 'Cannot initiate recovery for a disabled account.' };
  }

  const originalProfileEmail = targetUser.email.toLowerCase();

  if (originalProfileEmail === replacementEmail) {
    return { success: false, status: 400, error: 'Replacement email is identical to current registered email.' };
  }

  // 2. Check collision in public.profiles
  const { rows: collisionRows } = await dbQuery(
    'SELECT id FROM public.profiles WHERE LOWER(email) = $1 AND id != $2 LIMIT 1',
    [replacementEmail, targetUserId]
  );
  if (collisionRows && collisionRows.length > 0) {
    return { success: false, status: 400, error: 'Replacement email is already associated with another existing account.' };
  }

  // 3. Verify target exists in Supabase Auth and capture current state before mutation
  const { data: authUserData, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
  if (authUserErr || !authUserData?.user) {
    logger.error('Target user not found in Supabase Auth before recovery mutation', {
      targetUserId,
      error: authUserErr?.message || 'User not found in Auth',
    });
    return { success: false, status: 404, error: 'User Auth identity' };
  }

  const originalAuthEmail = authUserData.user.email ? authUserData.user.email.toLowerCase() : null;

  // Idempotency check: if both systems are already consistent at replacementEmail
  if (originalAuthEmail === replacementEmail && originalProfileEmail === replacementEmail) {
    return {
      success: true,
      status: 200,
      message: `Account email is already updated to ${replacementEmail}.`,
    };
  }

  // 4. Update email in Supabase Auth
  const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    email: replacementEmail,
    email_confirm: true,
  });

  if (authUpdateErr) {
    logger.error('Failed to update email in Supabase Auth', {
      targetUserId,
      error: authUpdateErr.message,
    });
    return { success: false, status: 500, error: `Auth update failed: ${authUpdateErr.message}` };
  }

  // 5. Update database profile, registrations, and append audit log in a single transaction
  let dbSuccess = false;
  let dbErrorMessage = '';

  try {
    await dbQuery('BEGIN');

    // Optimistic concurrency check: ensure profile email was not concurrently changed
    const profileUpdateResult = await dbQuery(
      'UPDATE public.profiles SET email = $1, force_logout_before = NOW(), updated_at = NOW() WHERE id = $2 AND LOWER(email) = $3 RETURNING id',
      [replacementEmail, targetUserId, originalProfileEmail]
    );

    if (!profileUpdateResult.rows || profileUpdateResult.rows.length === 0) {
      throw new Error('Concurrent modification detected: profile email was modified by another operation.');
    }

    // Update hackathon_registrations if existing
    await dbQuery(
      'UPDATE public.hackathon_registrations SET email = $1, updated_at = NOW() WHERE LOWER(email) = $2',
      [replacementEmail, originalProfileEmail]
    );

    // Mirror in auth.users shadow table if exists in database
    await dbQuery(
      'UPDATE auth.users SET email = $1 WHERE id = $2',
      [replacementEmail, targetUserId]
    ).catch(() => {});

    // Append audit log within the same database transaction
    await dbQuery(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, 'PARTICIPANT_INACCESSIBLE_EMAIL_RECOVERY', 'profiles', $2, $3)`,
      [
        adminUserId,
        targetUserId,
        JSON.stringify({
          target_identifier: targetUser.identifier,
          previous_email: targetUser.email,
          replacement_email: replacementEmail,
          reason: trimmedReason,
          sessions_revoked: true,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    await dbQuery('COMMIT');
    dbSuccess = true;
  } catch (dbErr: any) {
    dbErrorMessage = dbErr?.message || 'Database transaction failed';
    try {
      await dbQuery('ROLLBACK');
    } catch (rollbackErr: any) {
      logger.error('Failed to rollback database transaction', { error: rollbackErr?.message });
    }
    logger.error('Failed to update profile email in database', { error: dbErrorMessage });
  }

  // 6. Failure handling & compensation if database transaction failed
  if (!dbSuccess) {
    let compensationSuccess = false;
    let compensationErrMessage = '';

    if (originalAuthEmail) {
      const { error: compErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        email: originalAuthEmail,
        email_confirm: true,
      });

      if (!compErr) {
        compensationSuccess = true;
      } else {
        compensationErrMessage = compErr.message;
      }
    }

    if (compensationSuccess) {
      logger.warn('Participant email recovery database update failed; successfully reverted Supabase Auth email', {
        targetUserId,
        revertedToEmail: originalAuthEmail,
        dbError: dbErrorMessage,
      });
      return {
        success: false,
        status: 500,
        error: 'Failed to commit profile email update in database. Supabase Auth was safely reverted to its original state.',
      };
    } else {
      // Critical identity desynchronization: database rolled back but Auth compensation failed
      logger.error('CRITICAL: Inaccessible email recovery compensation failed. Identity desynchronization occurred.', {
        targetUserId,
        authEmail: replacementEmail,
        profileEmail: targetUser.email,
        compensationError: compensationErrMessage,
        dbError: dbErrorMessage,
      });

      try {
        await dbQuery(
          `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
           VALUES ($1, 'CRITICAL_EMAIL_RECOVERY_DESYNC', 'profiles', $2, $3)`,
          [
            adminUserId,
            targetUserId,
            JSON.stringify({
              target_identifier: targetUser.identifier,
              auth_email: replacementEmail,
              profile_email: targetUser.email,
              reconciliation_required: true,
              compensation_error: compensationErrMessage,
              db_error: dbErrorMessage,
              timestamp: new Date().toISOString(),
            }),
          ]
        );
      } catch (auditErr: any) {
        logger.error('Failed to record critical reconciliation audit event', { error: auditErr?.message });
      }

      return {
        success: false,
        status: 500,
        reconciliationRequired: true,
        error: `CRITICAL_DESYNC: Database update failed (${dbErrorMessage}) and automatic compensation of Supabase Auth email also failed (${compensationErrMessage || 'no original email'}). Auth email is currently out of sync with profile. Operator action required to reconcile account ${targetUser.identifier} (${targetUserId}).`,
      };
    }
  }

  // 7. Dispatch recovery email to replacement email
  let dispatchWarning: string | null = null;
  try {
    const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(replacementEmail, {
      redirectTo,
    });

    if (resetErr) {
      logger.warn('Password recovery email dispatch failed after email update', { error: resetErr.message });
      dispatchWarning = `Email updated, but password reset email dispatch failed: ${resetErr.message}. Operator may trigger manual reset.`;
    }
  } catch (resetException: any) {
    logger.warn('Password recovery email dispatch exception', { error: resetException?.message });
    dispatchWarning = 'Email updated, but password reset email dispatch failed. Operator may trigger manual reset.';
  }

  logger.info('Participant email recovery successfully completed', {
    adminId: adminUserId,
    targetUserId,
    oldEmail: targetUser.email,
    replacementEmail,
  });

  return {
    success: true,
    status: 200,
    message: `Account email updated to ${replacementEmail} and previous sessions revoked.${dispatchWarning ? ' ' + dispatchWarning : ' Password setup link dispatched.'}`,
    warning: dispatchWarning || undefined,
  };
}
