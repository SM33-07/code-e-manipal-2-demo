import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { query } from "@/lib/db";
import { successResponse, Errors, NO_CACHE_HEADERS } from "@/lib/utils/response";
import { isValidUUID } from "@/lib/utils/validate";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/notifications/read
 *
 * Marks an individual notification or all notifications as read for the authenticated user.
 * Writes to public.user_notification_receipts without mutating the shared announcement.
 */
export const POST = withAuth(async (req, { user }) => {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty if marking all read
    }

    const { announcement_id, mark_all } = body;

    if (mark_all === true || !announcement_id) {
      // Mark all currently active announcements as read for this user
      await query(
        `INSERT INTO public.user_notification_receipts (user_id, announcement_id, is_read, read_at)
         SELECT $1, a.id, TRUE, NOW()
         FROM public.announcements a
         WHERE a.is_active = TRUE
         ON CONFLICT (user_id, announcement_id)
         DO UPDATE SET is_read = TRUE, read_at = NOW()`,
        [user.id]
      );

      logger.info("Marked all notifications as read", { userId: user.id });
      return successResponse({ success: true, unreadCount: 0 }, undefined, 200, NO_CACHE_HEADERS);
    }

    if (!isValidUUID(announcement_id)) {
      return Errors.BAD_REQUEST("Invalid announcement_id UUID format.", undefined, NO_CACHE_HEADERS);
    }

    // Mark single announcement as read
    await query(
      `INSERT INTO public.user_notification_receipts (user_id, announcement_id, is_read, read_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (user_id, announcement_id)
       DO UPDATE SET is_read = TRUE, read_at = NOW()`,
      [user.id, announcement_id]
    );

    // Get updated unread count
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS unread_count
       FROM public.announcements a
       LEFT JOIN public.user_notification_receipts r
         ON r.announcement_id = a.id AND r.user_id = $1
       WHERE a.is_active = TRUE AND COALESCE(r.is_read, FALSE) = FALSE`,
      [user.id]
    );

    const unreadCount = countRows[0]?.unread_count ?? 0;
    return successResponse({ success: true, unreadCount }, undefined, 200, NO_CACHE_HEADERS);
  } catch (err: any) {
    logger.error("POST /api/notifications/read failed", { error: String(err), userId: user.id });
    return Errors.INTERNAL("Failed to mark notification as read.", NO_CACHE_HEADERS);
  }
});
