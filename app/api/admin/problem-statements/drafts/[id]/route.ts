import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { updateDraftStatement } from '@/services/problemStatementService';
import { successResponse, Errors } from '@/lib/utils/response';

/**
 * PUT /api/admin/problem-statements/drafts/[id]
 *
 * Updates an individual draft challenge brief.
 */
export const PUT = withAuth(async (req: NextRequest, { user, profile, params }) => {
  try {
    const draftId = params?.id;
    if (!draftId) {
      return Errors.BAD_REQUEST('Draft ID is required.');
    }

    const updates = await req.json();

    const updated = await updateDraftStatement(
      draftId,
      updates,
      user.id,
      profile.email || undefined
    );

    return successResponse(updated);
  } catch (err: any) {
    return Errors.BAD_REQUEST('Failed to update draft: ' + err.message);
  }
}, 'admin');
