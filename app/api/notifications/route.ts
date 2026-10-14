import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { query } from "@/lib/db";
import { successResponse, Errors, NO_CACHE_HEADERS } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/notifications
 *
 * Retrieves active system announcements for the notification center.
 * If user is authenticated, resolves per-user unread status and receipts from
 * public.user_notification_receipts.
 */
export const GET = withAuth(async (req, { user }) => {
  try {
    const { searchParams } = req.nextUrl;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10), 1), 50);

    // Fetch latest active announcements joined with per-user receipt status
    const { rows: notifications } = await query(
      `SELECT a.id,
              a.content,
              a.type,
              a.link_url,
              a.event_id,
              a.created_at,
              COALESCE(r.is_read, FALSE) AS is_read,
              r.read_at
       FROM public.announcements a
       LEFT JOIN public.user_notification_receipts r
         ON r.announcement_id = a.id AND r.user_id = $1
       WHERE a.is_active = TRUE
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [user.id, limit]
    );

    // Count unread active notifications
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS unread_count
       FROM public.announcements a
       LEFT JOIN public.user_notification_receipts r
         ON r.announcement_id = a.id AND r.user_id = $1
       WHERE a.is_active = TRUE AND COALESCE(r.is_read, FALSE) = FALSE`,
      [user.id]
    );

    const unreadCount = countRows[0]?.unread_count ?? 0;

    return successResponse(
      {
        notifications,
        unreadCount,
        hasUnread: unreadCount > 0,
      },
      undefined,
      200,
      NO_CACHE_HEADERS
    );
  } catch (err: any) {
    logger.error("GET /api/notifications failed", { error: String(err), userId: user.id });
    return Errors.INTERNAL("Failed to retrieve notifications.", NO_CACHE_HEADERS);
  }
});
