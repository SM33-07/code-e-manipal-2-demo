import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { successResponse, Errors, NO_CACHE_HEADERS } from "@/lib/utils/response";
import { getUserTeamId } from "@/services/submissionService";
import { verifySubmissionEligibility } from "@/services/submissionGate";

/**
 * GET /api/submissions/eligibility
 *
 * Pre-flight submission gate check for the authenticated participant's team.
 * Strictly read-only; evaluates:
 * - Event phase & global freeze
 * - Individual team lock
 * - Effective deadline + approved extensions
 */
export const GET = withAuth(async (req, { user, profile }) => {
  try {
    const teamId = await getUserTeamId(user.id);
    if (!teamId) {
      return successResponse({
        eligible: false,
        code: 'NO_TEAM',
        message: 'You are not assigned to a registered team.',
        serverTime: new Date().toISOString(),
        isGloballyFrozen: false,
        isTeamLocked: false,
        hasExtension: false,
      }, undefined, 200, NO_CACHE_HEADERS);
    }

    const eligibility = await verifySubmissionEligibility(teamId);
    return successResponse({
      ...eligibility,
      teamId,
    }, undefined, 200, NO_CACHE_HEADERS);
  } catch (err: any) {
    return Errors.INTERNAL('Failed to determine submission eligibility.', NO_CACHE_HEADERS);
  }
});
