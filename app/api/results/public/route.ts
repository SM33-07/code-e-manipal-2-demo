import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/results/public
 * Public — returns ranked results if results_published is 'true'.
 * If unpublished or in 5-min publishing window, returns published: false status.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Check event_config for results_published state
    const configRes = await query(
      "SELECT key, value FROM public.event_config WHERE key IN ('results_published', 'results_publish_time')"
    );
    const config = configRes.rows.reduce((acc: Record<string, string>, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    let isPublished = config.results_published === 'true';

    // Auto-transition check for 5-min timer
    if (config.results_published === 'publishing' && config.results_publish_time) {
      if (Date.now() >= new Date(config.results_publish_time).getTime()) {
        await query(
          `INSERT INTO public.event_config (key, value, updated_at)
           VALUES ('results_published', 'true', NOW())
           ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`
        );
        isPublished = true;
      }
    }

    if (!isPublished) {
      return successResponse([], {
        published: false,
        status: config.results_published || 'false',
        publish_time: config.results_publish_time || null,
      });
    }

    // 2. Fetch ranked results from database function
    const { rows } = await query(
      'SELECT * FROM public.get_ranked_results(NULL, 1)'
    );

    const ranked = (rows ?? []).map((row: any) => ({
      id: row.submission_id,
      title: row.title,
      summary: row.summary,
      category: row.category,
      status: row.status,
      created_at: row.created_at,
      team_id: row.team_id,
      team_name: row.team_name,
      computed: {
        avg_innovation: Number(row.avg_innovation),
        avg_technical: Number(row.avg_technical),
        avg_presentation: Number(row.avg_presentation),
        avg_impact: Number(row.avg_impact),
        total_score: Number(row.total_score),
        review_count: Number(row.review_count),
        rank: Number(row.rank_num),
      },
    }));

    return successResponse(ranked, { published: true, total: ranked.length });
  } catch (err) {
    logger.error('GET /api/results/public failed', { error: String(err) });
    return Errors.INTERNAL('Failed to fetch public results.');
  }
}
