import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/middleware/withAuth';
import { publishRelease } from '@/services/problemStatementService';
import { successResponse, Errors } from '@/lib/utils/response';

/**
 * POST /api/admin/problem-statements/releases/[id]/publish
 *
 * Atomically publishes the specified release version.
 * - Sets this release as is_current_published = true.
 * - Marks all other releases as is_current_published = false.
 * - Updates event_config.problem_statements_published = true.
 * - Logs audit record.
 * - Revalidates caches for /problem-statements and /api/problem-statements.
 */
export const POST = withAuth(async (req: NextRequest, { user, profile, params }) => {
  try {
    const releaseId = params?.id;
    if (!releaseId) {
      return Errors.BAD_REQUEST('Release ID is required.');
    }

    const published = await publishRelease(
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

    return successResponse(published);
  } catch (err: any) {
    return Errors.BAD_REQUEST('Failed to publish release: ' + err.message);
  }
}, 'admin');
