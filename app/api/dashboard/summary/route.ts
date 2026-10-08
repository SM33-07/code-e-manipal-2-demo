import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import { getEventConfigState } from '@/lib/event/eventConfigHelper';
import { getTeamByUserId } from '@/services/teamService';
import { getSubmissionByTeamId } from '@/services/submissionService';
import { getLatestActiveAnnouncement } from '@/services/announcementService';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/dashboard/summary
 *
 * Priority 1 Parallel Hydration Endpoint for Participant Dashboard (Phase 7).
 * Concurrently resolves event state, team membership, canonical submission,
 * and active announcements without sequential waterfall requests.
 */
export const GET = withAuth(async (req: NextRequest, { user, profile }) => {
  try {
    // 1. Concurrently resolve event configuration, team, and active announcements
    const [eventConfig, team, announcement] = await Promise.all([
      getEventConfigState(),
      getTeamByUserId(user.id),
      getLatestActiveAnnouncement(),
    ]);

    // 2. Fetch canonical team submission if team exists
    let submission: any = null;
    if (team?.id) {
      submission = await getSubmissionByTeamId(team.id);
    }

    // 3. Assemble clean hydration payload
    const payload = {
      event: {
        phase: eventConfig.event_phase,
        startTime: eventConfig.start_time,
        endTime: eventConfig.end_time,
        bufferMinutes: eventConfig.buffer_minutes,
        resultsRelease: eventConfig.results_release,
        publishAt: eventConfig.publish_at,
      },
      team: team
        ? {
            id: team.id,
            name: team.name,
            inviteCode: team.invite_code,
            track: (team as any).track || 'General',
            leaderName: (team as any).leader_name || null,
            members: (team.team_members || []).map((m: any) => ({
              userId: m.user_id,
              role: m.role,
              name: m.profiles?.name || 'Team Member',
              email: m.profiles?.email || '',
              avatarUrl: m.profiles?.avatar_url || '',
            })),
          }
        : null,
      submission: submission
        ? {
            id: submission.id,
            title: submission.title,
            summary: submission.summary,
            category: submission.category,
            status: submission.status,
            githubUrl: submission.github_url,
            demoUrl: submission.demo_url,
            docsUrl: submission.docs_url,
            demoVideoUrl: submission.demo_video_url,
            submittedAt: submission.submitted_at,
            isLocked:
              submission.status?.toLowerCase() === 'submitted' ||
              submission.status?.toLowerCase() === 'locked' ||
              submission.status?.toLowerCase() === 'under_review' ||
              submission.status?.toLowerCase() === 'reviewed',
          }
        : null,
      announcement: announcement || null,
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        identifier: profile.identifier,
      },
    };

    return successResponse(payload);
  } catch (err: any) {
    logger.error('GET /api/dashboard/summary error', {
      error: err.message,
      userId: user.id,
    });
    return Errors.INTERNAL('Failed to load dashboard summary.');
  }
}, 'participant');
