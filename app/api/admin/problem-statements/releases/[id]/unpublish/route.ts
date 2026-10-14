import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/middleware/withAuth';
import { unpublishRelease } from '@/services/problemStatementService';
import { successResponse, Errors } from '@/lib/utils/response';

/**
 * POST /api/admin/problem-statements/releases/[id]/unpublish
 *
 * Emergency withdrawal: Atomically unpublishes the release.
 * - Sets is_current_published = false and status = 'withdrawn'.
 * - Sets event_config.problem_statements_published = false.
 * - Invalidate ISR caches immediately.
 */
export const POST = withAuth(async (req: NextRequest, { user, profile, params }) => {
  try {
    const releaseId = params?.id;
    if (!releaseId) {
      return Errors.BAD_REQUEST('Release ID is required.');
    }

    const withdrawn = await unpublishRelease(
      releaseId,
      user.id,
      profile.email || undefined
    );

    // Invalidate ISR caches immediately
    try {
      revalidatePath('/problem-statements');
      revalidatePath('/api/problem-statements');
    } catch (e) {
      // Best-effort cache purge in serverless
    }

    return successResponse(withdrawn);
  } catch (err: any) {
    return Errors.BAD_REQUEST('Failed to unpublish release: ' + err.message);
  }
}, 'admin');
