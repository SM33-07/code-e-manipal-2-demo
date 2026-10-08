import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { getLatestActiveAnnouncement } from '@/services/announcementService';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import { getEventConfigState } from '@/lib/event/eventConfigHelper';

async function checkAndTriggerAutoCloseAnnouncement() {
  try {
    const config = await getEventConfigState();

    if (config.hackathon_is_started === 'true' && config.hackathon_start_time) {
      const startTime = new Date(config.hackathon_start_time).getTime();
      const durationHours = parseFloat(config.hackathon_duration_hours || '48');
      const endTime = startTime + durationHours * 60 * 60 * 1000;

      if (Date.now() > endTime) {
        const msg = '⏰ Submissions are now closed! Thank you for participating. Teams with approved extensions may still submit.';
        const checkRes = await query('SELECT id FROM public.announcements WHERE content = $1 LIMIT 1', [msg]);
        if (checkRes.rows.length === 0) {
          await query(
            `INSERT INTO public.announcements (content, type, is_active) 
             VALUES ($1, 'urgent', TRUE)`,
            [msg]
          );
          logger.info('Automated deadline closure announcement broadcasted');
        }
      }
    }
  } catch (err) {
    logger.error('Failed to run checkAndTriggerAutoCloseAnnouncement', { error: String(err) });
  }
}

/**
 * GET /api/announcements
 * Retrieve the latest active announcement.
 * Role requirement: participant or higher (any logged in user).
 */
export const GET = withAuth(async (req) => {
  try {
    await checkAndTriggerAutoCloseAnnouncement();
    const announcement = await getLatestActiveAnnouncement();
    return successResponse(announcement);
  } catch (err) {
    logger.error('GET /api/announcements', { error: String(err) });
    return Errors.INTERNAL('Failed to fetch announcements.');
  }
}, 'participant');
