import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import {
  getAdminReleases,
  getAdminReleaseDetail,
  getAdminAuditLogs,
} from '@/services/problemStatementService';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';

/**
 * GET /api/admin/problem-statements
 *
 * Administrator Endpoint (Admin-Only):
 * Returns all releases, active published release, drafts for the selected release,
 * and recent audit logs.
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const requestedReleaseId = url.searchParams.get('releaseId');

    const releases = await getAdminReleases();

    // Default to currently published release, or the latest version
    let activeRelease = releases.find((r) => r.is_current_published);
    if (!activeRelease && releases.length > 0) {
      activeRelease = releases[0];
    }

    const targetReleaseId = requestedReleaseId || activeRelease?.id;
    let releaseDetail: any = null;
    if (targetReleaseId) {
      releaseDetail = await getAdminReleaseDetail(targetReleaseId);
    }

    const auditLogs = await getAdminAuditLogs(30);

    const { rows: configRows } = await pool.query(`
      SELECT problem_statements_published, active_problem_release_id,
             problem_selection_start, problem_selection_end
      FROM public.event_config
      WHERE id = 1;
    `);

    return successResponse({
      config: configRows[0] || null,
      releases,
      selectedReleaseId: targetReleaseId,
      releaseDetail: releaseDetail?.release || null,
      drafts: releaseDetail?.drafts || [],
      auditLogs,
    });
  } catch (err: any) {
    return Errors.INTERNAL('Failed to fetch admin problem statement data: ' + err.message);
  }
}, 'admin');
