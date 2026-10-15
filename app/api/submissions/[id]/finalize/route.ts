import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { successResponse, Errors, NO_CACHE_HEADERS } from "@/lib/utils/response";
import { isValidUUID } from "@/lib/utils/validate";
import { logger } from "@/lib/utils/logger";
import { finalizeSubmissionTransaction } from "@/services/submissionService";

/**
 * POST /api/submissions/[id]/finalize
 *
 * Finalizes a submission with immutable timestamp and lock flag.
 *
 * Enforces Phase 4 Anti-TOCTOU Invariant:
 * 1. Serialized transaction with row locks on event_config and submissions.
 * 2. event_phase must strictly be 'SUBMISSION'.
 * 3. Authenticated user must belong to submission's team. Non-disclosing 404 if not.
 * 4. Submission must be in 'draft' state.
 * 5. Pre-flight criteria verified (title, summary, category, github_url, technologies).
 * 6. Sets status = 'submitted', is_locked = true, final_submitted_at = NOW().
 */
export const POST = withAuth(async (req, { user, profile, params }) => {
  const id = params?.id!;

  if (!isValidUUID(id)) {
    return Errors.BAD_REQUEST("Invalid submission ID format.", undefined, NO_CACHE_HEADERS);
  }

  if (profile.role !== 'participant' && profile.role !== 'admin') {
    return Errors.FORBIDDEN("Only participants or admins may finalize submissions.", NO_CACHE_HEADERS);
  }

  try {
    const finalized = await finalizeSubmissionTransaction(id, user.id);
    logger.info('POST /api/submissions/[id]/finalize succeeded', {
      submissionId: id,
      teamId: finalized.team_id,
      userId: user.id,
      final_submitted_at: finalized.final_submitted_at,
    });

    return successResponse(finalized, undefined, 200, NO_CACHE_HEADERS);
  } catch (err: any) {
    if (err.message === 'SUBMISSION_NOT_FOUND') {
      return Errors.NOT_FOUND("Submission", NO_CACHE_HEADERS);
    }
    if (err.message === 'SUBMISSIONS_FROZEN_GLOBALLY') {
      return Errors.FORBIDDEN("Submissions are temporarily frozen globally by event administrators.", NO_CACHE_HEADERS);
    }
    if (err.message === 'TEAM_SUBMISSION_LOCKED') {
      return Errors.FORBIDDEN("Submissions for your team have been locked by an administrator.", NO_CACHE_HEADERS);
    }
    if (err.message === 'FINALIZATION_NOT_ALLOWED_IN_HACKING') {
      return Errors.FORBIDDEN(
        "Final submission is not allowed during the HACKING phase. Submissions can only be finalized during the SUBMISSION phase.",
        NO_CACHE_HEADERS
      );
    }
    if (err.message === 'SUBMISSION_WINDOW_CLOSED') {
      return Errors.FORBIDDEN("Submission window is closed. Finalization is no longer accepted.", NO_CACHE_HEADERS);
    }
    if (err.message === 'FORBIDDEN_NOT_TEAM_MEMBER') {
      return Errors.NOT_FOUND("Submission", NO_CACHE_HEADERS);
    }
    if (err.message === 'SUBMISSION_ALREADY_FINALIZED') {
      return Errors.CONFLICT("Submission is already finalized.", NO_CACHE_HEADERS);
    }
    if (err.message === 'FINALIZATION_VALIDATION_FAILED') {
      return Errors.BAD_REQUEST("Submission does not satisfy finalization requirements.", {
        errors: (err as any).details || [],
      }, NO_CACHE_HEADERS);
    }
    if (err.message === 'SERIALIZATION_FAILURE_EXHAUSTED') {
      return Errors.CONFLICT("Concurrent finalization conflict. Please retry.", NO_CACHE_HEADERS);
    }

    logger.error('POST /api/submissions/[id]/finalize failed', { error: String(err), id, userId: user.id });
    return Errors.INTERNAL('Internal server error', NO_CACHE_HEADERS);
  }
});
