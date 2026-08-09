import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/event-config
 * Public — retrieves hackathon global timer settings.
 */
export async function GET(req: NextRequest) {
  try {
    const { rows } = await query('SELECT key, value FROM public.event_config');
    const config = rows.reduce((acc: Record<string, string>, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    // Check if results_published is 'publishing' and 5-min timer has passed
    if (config.results_published === 'publishing' && config.results_publish_time) {
      const publishTime = new Date(config.results_publish_time).getTime();
      if (Date.now() >= publishTime) {
        // Auto-transition to published ('true')
        await query(
          `INSERT INTO public.event_config (key, value, updated_at)
           VALUES ('results_published', 'true', NOW())
           ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`
        );
        config.results_published = 'true';
      }
    }

    return successResponse(config);
  } catch (err) {
    logger.error('GET /api/event-config failed', { error: String(err) });
    return Errors.INTERNAL('Failed to fetch event configuration.');
  }
}

/**
 * PATCH /api/event-config
 * Admin only — updates hackathon global timer settings and results publishing state.
 */
export const PATCH = withAuth(async (req, { user }) => {
  try {
    const body = await req.json();
    const {
      hackathon_start_time,
      hackathon_duration_hours,
      hackathon_is_started,
      results_published,
      results_publish_time,
    } = body;

    const updates = [];
    if (hackathon_start_time !== undefined) updates.push({ key: 'hackathon_start_time', val: String(hackathon_start_time) });
    if (hackathon_duration_hours !== undefined) updates.push({ key: 'hackathon_duration_hours', val: String(hackathon_duration_hours) });
    if (hackathon_is_started !== undefined) updates.push({ key: 'hackathon_is_started', val: String(hackathon_is_started) });
    if (results_published !== undefined) updates.push({ key: 'results_published', val: String(results_published) });
    if (results_publish_time !== undefined) updates.push({ key: 'results_publish_time', val: String(results_publish_time) });

    if (updates.length === 0) {
      return Errors.BAD_REQUEST('No updates specified');
    }

    // Run updates in a transaction
    await query('BEGIN');
    try {
      for (const update of updates) {
        await query(
          `INSERT INTO public.event_config (key, value, updated_at) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [update.key, update.val]
        );
      }

      // If we are starting the hackathon, archive any existing Submissions Closed announcements
      if (hackathon_is_started === 'true' || hackathon_is_started === true) {
        const closeMsg = '⏰ Submissions are now closed! Thank you for participating. Teams with approved extensions may still submit.';
        await query(
          `UPDATE public.announcements 
           SET is_active = FALSE 
           WHERE content = $1`,
          [closeMsg]
        );
      }

      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK');
      throw e;
    }

    logger.info('PATCH /api/event-config successful', { updates, userId: user.id });

    // Fetch updated config to return
    const { rows } = await query('SELECT key, value FROM public.event_config');
    const updatedConfig = rows.reduce((acc: Record<string, string>, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    return successResponse(updatedConfig);
  } catch (err) {
    logger.error('PATCH /api/event-config failed', { error: String(err) });
    return Errors.INTERNAL('Failed to update event configuration.');
  }
}, 'admin');
