import { NextRequest, NextResponse } from 'next/server';
import { getPublicProblemStatements } from '@/services/problemStatementService';
import { Errors } from '@/lib/utils/response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/problem-statements
 *
 * Public endpoint that delivers ONLY the approved challenge briefs of the
 * currently published release.
 *
 * Security Invariants:
 * - When event_config.problem_statements_published is FALSE, returns neutral locked state.
 * - Drafts, held items, and unapproved proposals are strictly excluded.
 * - Internal organizer notes and review statuses are never exposed.
 */
export async function GET(req: NextRequest) {
  try {
    const data = await getPublicProblemStatements();

    if (!data.isPublished) {
      return NextResponse.json({
        success: true,
        data: {
          published: false,
          release: null,
          statements: [],
          tracks: [],
        },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        published: true,
        release: data.release,
        statements: data.statements,
        tracks: data.tracks,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch public problem statements:', error?.message, error?.stack);
    return Errors.INTERNAL('Failed to fetch public problem statements.');
  }
}
