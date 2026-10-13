import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { Errors, successResponse } from '@/lib/utils/response';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSetupPasswordRedirectUrl } from '@/lib/auth/siteUrl';
import { logger } from '@/lib/utils/logger';
import { executeInaccessibleEmailRecovery } from '@/lib/auth/inaccessibleEmailRecovery';

/**
 * POST /api/admin/users/:id/inaccessible-email-recovery
 * Admin only — Secure, failure-safe fallback for participants who cannot access their registered email.
 *
 * Security Controls:
 * - Strictly restricted to participant accounts (admins/judges forbidden)
 * - Required audit notes (min 10 chars)
 * - Pre-mutation state capture
 * - Atomic database profile, registration, and audit transaction
 * - Compensating Auth update with verification if DB fails
 * - Critical reconciliation event logged if compensation fails
 * - Revocation of active sessions
 * - Zero tokens or passwords exposed
 */
export const POST = withAuth(async (req, { user: adminUser, params }) => {
  try {
    const targetUserId = params?.id;
    if (!targetUserId) {
      return Errors.BAD_REQUEST('Invalid target user ID');
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid request body.');
    }

    const redirectTo = getSetupPasswordRedirectUrl();
    const supabaseAdmin = createSupabaseAdminClient();

    const result = await executeInaccessibleEmailRecovery({
      targetUserId,
      replacementEmail: body?.replacement_email,
      reason: body?.reason,
      adminUserId: adminUser.id,
      dbQuery: query,
      supabaseAdmin,
      redirectTo,
    });

    if (!result.success) {
      if (result.status === 400) return Errors.BAD_REQUEST(result.error!);
      if (result.status === 403) return Errors.FORBIDDEN(result.error!);
      if (result.status === 404) return Errors.NOT_FOUND(result.error!);
      return Errors.INTERNAL(result.error!);
    }

    return successResponse({
      message: result.message,
      warning: result.warning,
    });
  } catch (error: any) {
    logger.error('POST /api/admin/users/:id/inaccessible-email-recovery handler exception', { error: String(error) });
    return Errors.INTERNAL('Failed to initiate inaccessible email recovery.');
  }
}, 'admin');
