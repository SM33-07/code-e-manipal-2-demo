import { NextResponse } from 'next/server';
import { getPublishedTimeline } from '@/services/timelineService';
import { Errors } from '@/lib/utils/response';

export const revalidate = 0; // Dynamic status derivation requires live response with short cache

export async function GET() {
  try {
    const { events, serverTime, config } = await getPublishedTimeline();

    if (!config.is_published) {
      return NextResponse.json({
        success: true,
        data: {
          published: false,
          publishedAt: null,
          version: null,
          events: [],
          serverTime,
        },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        published: true,
        publishedAt: config.published_at,
        version: config.published_version,
        events,
        serverTime,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
      },
    });
  } catch (error) {
    return Errors.INTERNAL('Failed to fetch event timeline.');
  }
}

