import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { createDraftRelease } from '@/services/problemStatementService';
import { successResponse, Errors } from '@/lib/utils/response';

/**
 * POST /api/admin/problem-statements/releases
 *
 * Creates a new draft release version.
 * Optionally clones all drafts from a source release version.
 */
export const POST = withAuth(async (req: NextRequest, { user, profile }) => {
  try {
    const body = await req.json();
    const { label, sourceReleaseId, releaseNotes } = body;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return Errors.BAD_REQUEST('Release label is required.');
    }

    const createdRelease = await createDraftRelease(
      label.trim(),
      sourceReleaseId,
      releaseNotes,
      user.id,
      profile.email || undefined
    );

    return successResponse(createdRelease, undefined, 201);
  } catch (err: any) {
    return Errors.INTERNAL('Failed to create release: ' + err.message);
  }
}, 'admin');
