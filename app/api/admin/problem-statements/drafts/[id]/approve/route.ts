import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { toggleDraftApproval } from '@/services/problemStatementService';
import { successResponse, Errors } from '@/lib/utils/response';

/**
 * POST /api/admin/problem-statements/drafts/[id]/approve
 *
 * Toggles whether a challenge brief is approved for inclusion in the release.
 */
export const POST = withAuth(async (req: NextRequest, { user, profile, params }) => {
  try {
    const draftId = params?.id;
    if (!draftId) {
      return Errors.BAD_REQUEST('Draft ID is required.');
    }

    const body = await req.json();
    const isApproved = Boolean(body.isApproved);

    const updated = await toggleDraftApproval(
      draftId,
      isApproved,
      user.id,
      profile.email || undefined
    );

    return successResponse(updated);
  } catch (err: any) {
    return Errors.BAD_REQUEST('Failed to update approval: ' + err.message);
  }
}, 'admin');
