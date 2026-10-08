import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { successResponse, Errors } from "@/lib/utils/response";
import { isValidUUID } from "@/lib/utils/validate";
import { logger } from "@/lib/utils/logger";
import { query } from "@/lib/db";
import {
  getSubmissionById,
  getUserTeamId,
  updateSubmission,
  deleteSubmission,
} from "@/services/submissionService";
import { validateUpdateSubmission } from "@/lib/validation/submission";

/**
 * GET /api/submissions/[id]
 *
 * Strict resource ownership verification:
 * - Participant: CANNOT read other teams' submissions. Allowed only if user belongs to submission.team_id.
 * - Judge: Allowed only if assigned to this submission.
 * - Admin: Allowed.
 */
export const GET = withAuth(async (req, { user, profile, params }) => {
  const id = params?.id!;

  if (!isValidUUID(id)) {
    return Errors.BAD_REQUEST("Invalid submission ID format.");
  }

  try {
    const submission = await getSubmissionById(id);
    if (!submission) {
      return Errors.NOT_FOUND("Submission");
    }

    if (profile.role === 'participant') {
      const userTeamId = await getUserTeamId(user.id);
      if (!userTeamId || submission.team_id !== userTeamId) {
        return Errors.FORBIDDEN("Access denied: You can only view your own team's submission.");
      }
    } else if (profile.role === 'judge') {
      const { rows: assignment } = await query(
        'SELECT 1 FROM public.judge_assignments WHERE judge_id = $1 AND submission_id = $2',
        [user.id, id]
      );
      if (assignment.length === 0) {
        return Errors.FORBIDDEN("Access denied: You are not assigned to evaluate this submission.");
      }
    }

    logger.info('GET /api/submissions/[id]', { submissionId: id, userId: user.id });
    return successResponse(submission);
  } catch (err: any) {
    logger.error('GET /api/submissions/[id] failed', { error: String(err), id, userId: user.id });
    return Errors.INTERNAL();
  }
});

/**
 * PUT /api/submissions/[id]
 *
 * Updates draft submission fields.
 * Enforces:
 * - Team ownership (cannot update another team's submission).
 * - Lock invariant: if status === 'submitted' or is_locked === true, edits are strictly rejected (403).
 * - Phase boundary: must be HACKING or SUBMISSION; rejected after SUBMISSION_CLOSED.
 * - Strict field allowlist; cannot touch final_submitted_at or status.
 */
export const PUT = withAuth(async (req, { user, profile, params }) => {
  const id = params?.id!;

  if (!isValidUUID(id)) {
    return Errors.BAD_REQUEST("Invalid submission ID format.");
  }

  if (profile.role !== 'participant' && profile.role !== 'admin') {
    return Errors.FORBIDDEN("Only participants or admins may update submissions.");
  }

  try {
    const userTeamId = await getUserTeamId(user.id);
    if (!userTeamId && profile.role === 'participant') {
      return Errors.FORBIDDEN("You must belong to a team to edit submissions.");
    }

    // Verify existing submission ownership before parsing body
    const existing = await getSubmissionById(id);
    if (!existing) {
      return Errors.NOT_FOUND("Submission");
    }

    if (profile.role === 'participant' && existing.team_id !== userTeamId) {
      return Errors.FORBIDDEN("Access denied: You cannot edit another team's submission.");
    }

    if (existing.status === 'submitted' || existing.is_locked === true) {
      return Errors.FORBIDDEN("Submission is finalized and locked. Further modifications are prohibited.");
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST("Invalid JSON body.");
    }

    const validation = validateUpdateSubmission(body);
    if (!validation.valid || !validation.data) {
      return Errors.BAD_REQUEST("Validation failed", { errors: validation.errors });
    }

    if (Object.keys(validation.data).length === 0) {
      return Errors.BAD_REQUEST("No valid fields provided for update.");
    }

    const updated = await updateSubmission(id, existing.team_id, validation.data);
    logger.info('PUT /api/submissions/[id]', { submissionId: id, userId: user.id });
    return successResponse(updated);
  } catch (err: any) {
    if (err.message === 'EVENT_NOT_STARTED') {
      return Errors.FORBIDDEN("Hackathon has not started yet.");
    }
    if (err.message === 'SUBMISSION_WINDOW_CLOSED') {
      return Errors.FORBIDDEN("Submission window is closed.");
    }
    if (err.message === 'SUBMISSION_LOCKED') {
      return Errors.FORBIDDEN("Submission is finalized and locked. Further modifications are prohibited.");
    }
    if (err.message === 'FORBIDDEN_NOT_TEAM_MEMBER') {
      return Errors.FORBIDDEN("Access denied: You are not a member of this team.");
    }
    if (err.message === 'SERIALIZATION_FAILURE_EXHAUSTED') {
      return Errors.CONFLICT("Concurrent modification conflict. Please retry.");
    }

    logger.error('PUT /api/submissions/[id] failed', { error: String(err), id, userId: user.id });
    return Errors.INTERNAL();
  }
});

/**
 * DELETE /api/submissions/[id]
 *
 * Hard delete (admin only).
 */
export const DELETE = withAuth(async (_req, { user, profile, params }) => {
  const id = params?.id!;

  if (!isValidUUID(id)) {
    return Errors.BAD_REQUEST("Invalid submission ID format.");
  }

  try {
    const existing = await getSubmissionById(id);
    if (!existing) return Errors.NOT_FOUND("Submission");

    await deleteSubmission(id);
    logger.info('DELETE /api/submissions/[id]', { submissionId: id, userId: user.id, role: profile.role });
    return successResponse({ message: "Submission deleted successfully." });
  } catch (err: any) {
    logger.error('DELETE /api/submissions/[id] failed', { error: String(err), id });
    return Errors.INTERNAL();
  }
}, 'admin');