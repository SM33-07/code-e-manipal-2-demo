import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { successResponse, Errors } from "@/lib/utils/response";
import { isValidUUID } from "@/lib/utils/validate";
import { logger } from "@/lib/utils/logger";
import { adminReopenSubmissionTransaction } from "@/services/submissionService";

/**
 * POST /api/admin/submissions/[id]/reopen
 *
 * Normal admin submission reopen route.
 * Permitted strictly during the SUBMISSION phase (prior to deadline).
 *
 * Enforces:
 * 1. Admin authorization only.
 * 2. Mandatory audit reason string (min 10 characters).
 * 3. Rejects with 403 Forbidden if event_phase is not SUBMISSION (post-deadline reopening barred).
 * 4. Resets status = 'draft', is_locked = false, final_submitted_at = NULL.
 * 5. Records immutable audit log record.
 */
export const POST = withAuth(async (req, { user, params }) => {
  const id = params?.id!;

  if (!isValidUUID(id)) {
    return Errors.BAD_REQUEST("Invalid submission ID format.");
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST("Invalid JSON body.");
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason || reason.length < 10) {
    return Errors.BAD_REQUEST("A mandatory justification reason (at least 10 characters) is required to reopen a submission.");
  }

  try {
    const reopened = await adminReopenSubmissionTransaction(id, user.id, reason);
    logger.info('POST /api/admin/submissions/[id]/reopen succeeded', {
      submissionId: id,
      adminId: user.id,
      reason,
    });

    return successResponse(reopened);
  } catch (err: any) {
    if (err.message === 'SUBMISSION_NOT_FOUND') {
      return Errors.NOT_FOUND("Submission");
    }
    if (err.message === 'REOPEN_ONLY_ALLOWED_IN_SUBMISSION') {
      return Errors.FORBIDDEN(
        "Submissions can only be reopened during the active SUBMISSION phase. Post-deadline reopening is prohibited."
      );
    }
    if (err.message === 'SERIALIZATION_FAILURE_EXHAUSTED') {
      return Errors.CONFLICT("Concurrent transaction conflict. Please retry.");
    }

    logger.error('POST /api/admin/submissions/[id]/reopen failed', { error: String(err), id, adminId: user.id });
    return Errors.INTERNAL();
  }
}, 'admin');
