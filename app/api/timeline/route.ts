import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';

export const revalidate = 60; // 60-second ISR caching, revalidated on admin publish

export async function GET() {
  try {
    const { rows: configRows } = await pool.query(`
      SELECT is_published, published_at, published_version
      FROM public.timeline_config
      WHERE id = 1;
    `);

    const isPublished = configRows.length > 0 ? configRows[0].is_published : true;

    if (!isPublished) {
      return NextResponse.json({
        success: true,
        data: {
          published: false,
          publishedAt: null,
          version: null,
          events: [],
        },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    }

    const { rows: events } = await pool.query(`
      SELECT id, title, day_label, time_range, start_time, end_time,
             venue, description, display_order, card_position, status, event_type
      FROM public.timeline_events
      WHERE is_published = true
      ORDER BY display_order ASC;
    `);

    return NextResponse.json({
      success: true,
      data: {
        published: true,
        publishedAt: configRows[0]?.published_at,
        version: configRows[0]?.published_version,
        events,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    return Errors.INTERNAL('Failed to fetch event timeline.');
  }
}
