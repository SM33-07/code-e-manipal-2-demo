import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { successResponse, Errors } from "@/lib/utils/response";
import { isValidUUID } from "@/lib/utils/validate";
import { logger } from "@/lib/utils/logger";
import { adminEmergencyOverrideSubmissionTransaction } from "@/services/submissionService";

/**
 * POST /api/admin/submissions/[id]/emergency-override
 *
 * Emergency administrative post-deadline submission override.
 * Permitted only under verified emergency circumstances (e.g. platform outage).
 *
 * CRITICAL TIE-BREAKER INVARIANT:
 * 1. final_submitted_at is NEVER altered, forged, or backfilled.
 * 2. Dedicated emergency metadata is populated:
 *    - emergency_override_at
 *    - emergency_override_by
 *    - emergency_override_reason
 * 3. Status is transitioned to 'submitted' with is_locked = true.
 * 4. Immutable audit record logged in audit_logs.
 * 5. Deterministic tie-breaking ranks emergency projects strictly behind all on-time submissions.
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
    return Errors.BAD_REQUEST(
      "A mandatory justification reason (at least 10 characters) is required for emergency override."
    );
  }

  // Dual-organizer sign-off verification per v4 baseline
  const approvals: string[] = Array.isArray(body.approvals) ? body.approvals : [];
  if (approvals.length === 0) {
    return Errors.BAD_REQUEST(
      "Dual-organizer sign-off is required: exactly two organizer approvals must be provided."
    );
  }
  if (approvals.length === 1) {
    return Errors.BAD_REQUEST(
      "Dual-organizer sign-off incomplete: two distinct organizer approvals are required."
    );
  }
  if (approvals.length > 2) {
    return Errors.BAD_REQUEST(
      "Dual-organizer sign-off permits exactly two organizer approvals."
    );
  }
  if (approvals[0] === approvals[1]) {
    return Errors.BAD_REQUEST(
      "Dual-organizer sign-off requires two distinct administrators."
    );
  }
  if (!isValidUUID(approvals[0]) || !isValidUUID(approvals[1])) {
    return Errors.BAD_REQUEST(
      "Invalid approver ID format in dual-organizer sign-off."
    );
  }

  try {
    const overridden = await adminEmergencyOverrideSubmissionTransaction(
      id,
      user.id,
      reason,
      approvals
    );
    logger.warn('POST /api/admin/submissions/[id]/emergency-override executed', {
      submissionId: id,
      adminId: user.id,
      reason,
      approvals,
      emergency_override_at: overridden.emergency_override_at,
    });

    return successResponse(overridden);
  } catch (err: any) {
    if (err.message === 'SUBMISSION_NOT_FOUND') {
      return Errors.NOT_FOUND("Submission");
    }
    if (err.message === 'DUAL_APPROVAL_REQUIRED') {
      return Errors.BAD_REQUEST("Dual-organizer sign-off is required: two distinct organizer approvals must be provided.");
    }
    if (err.message === 'INVALID_APPROVERS') {
      return Errors.BAD_REQUEST("One or more approvers do not hold authorized administrator privileges.");
    }
    if (err.message === 'SERIALIZATION_FAILURE_EXHAUSTED') {
      return Errors.CONFLICT("Concurrent transaction conflict. Please retry.");
    }

    logger.error('POST /api/admin/submissions/[id]/emergency-override failed', {
      error: String(err),
      id,
      adminId: user.id,
    });
    return Errors.INTERNAL();
  }
}, 'admin');
