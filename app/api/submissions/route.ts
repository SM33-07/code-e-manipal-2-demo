import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { successResponse, Errors } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";
import {
  getUserTeamId,
  getSubmissionByTeamId,
  listSubmissions,
  createSubmission,
} from "@/services/submissionService";
import { validateCreateSubmission } from "@/lib/validation/submission";

/**
 * GET /api/submissions
 *
 * Authoritative resource scoping:
 * - Participant: Returns ONLY the authenticated user's team submission.
 * - Judge: Returns ONLY submissions assigned to this judge.
 * - Admin: Lists all submissions with pagination and filters.
 */
export const GET = withAuth(async (req, { user, profile }) => {
  try {
    const { searchParams } = req.nextUrl;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20'), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    if (profile.role === 'participant') {
      const userTeamId = await getUserTeamId(user.id);
      if (!userTeamId) {
        return successResponse([], { total: 0 });
      }

      const submission = await getSubmissionByTeamId(userTeamId);
      const items = submission ? [submission] : [];
      return successResponse(items, { total: items.length });
    }

    if (profile.role === 'judge') {
      const result = await listSubmissions(
        { limit, offset },
        { category, search, judgeId: user.id }
      );
      return successResponse(result.submissions, { total: result.total });
    }

    // Admin role
    const result = await listSubmissions(
      { limit, offset },
      { category, search }
    );
    return successResponse(result.submissions, { total: result.total });
  } catch (err: any) {
    logger.error('GET /api/submissions failed', { error: String(err), userId: user.id });
    return Errors.INTERNAL();
  }
});

/**
 * POST /api/submissions
 *
 * Creates a new draft submission for the participant's team.
 * Enforces:
 * - Authoritative team resolution (client-supplied team_id is ignored).
 * - Phase boundary enforcement (NOT_STARTED / SUBMISSION_CLOSED+ rejected).
 * - Strict schema validation.
 * - Single canonical submission via UNIQUE(team_id) database constraint.
 */
export const POST = withAuth(async (req, { user, profile }) => {
  if (profile.role !== 'participant' && profile.role !== 'admin') {
    return Errors.FORBIDDEN("Only participants or admins may create submissions.");
  }

  try {
    const userTeamId = await getUserTeamId(user.id);
    if (!userTeamId) {
      return Errors.FORBIDDEN("You must belong to a registered team to create a submission.");
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST("Invalid JSON body.");
    }

    // Strict schema & anti-SSRF URL validation
    const validation = validateCreateSubmission(body);
    if (!validation.valid || !validation.data) {
      return Errors.BAD_REQUEST("Validation failed", { errors: validation.errors });
    }

    const submission = await createSubmission(userTeamId, validation.data);
    logger.info('POST /api/submissions created', { submissionId: submission.id, teamId: userTeamId, userId: user.id });
    return successResponse(submission, undefined, 201);
  } catch (err: any) {
    if (err.message === 'EVENT_NOT_STARTED') {
      return Errors.FORBIDDEN("Hackathon has not started yet. Submissions are closed.");
    }
    if (err.message === 'SUBMISSION_WINDOW_CLOSED') {
      return Errors.FORBIDDEN("Submission window is closed.");
    }
    if (err.message === 'SUBMISSION_ALREADY_EXISTS') {
      return Errors.CONFLICT("A submission already exists for your team. Please update the existing draft.");
    }

    logger.error('POST /api/submissions failed', { error: String(err), userId: user.id });
    return Errors.INTERNAL();
  }
});