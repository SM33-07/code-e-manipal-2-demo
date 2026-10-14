import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';

export const revalidate = 60; // 60-second ISR caching, revalidated immediately on publish

/**
 * GET /api/problem-statements
 * Public endpoint that delivers only published problem statements.
 * Draft and unpublished statements are strictly excluded.
 */
export async function GET(req: NextRequest) {
  try {
    const { rows: configRows } = await pool.query(`
      SELECT problem_statements_published, problem_selection_start, problem_selection_end
      FROM public.event_config
      WHERE id = 1;
    `);

    const isGlobalPublished = configRows.length > 0 ? configRows[0].problem_statements_published : false;

    if (!isGlobalPublished) {
      return NextResponse.json({
        success: true,
        data: {
          published: false,
          selectionStart: configRows[0]?.problem_selection_start || null,
          selectionEnd: configRows[0]?.problem_selection_end || null,
          statements: [],
        },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    }

    const { rows: statements } = await pool.query(`
      SELECT id, title, track, description, requirements, deliverables,
             constraints, attachment_url, attachment_name, display_order, updated_at
      FROM public.problem_statements
      WHERE is_published = true
      ORDER BY display_order ASC, id ASC;
    `);

    return NextResponse.json({
      success: true,
      data: {
        published: true,
        selectionStart: configRows[0]?.problem_selection_start,
        selectionEnd: configRows[0]?.problem_selection_end,
        statements,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    return Errors.INTERNAL('Failed to fetch problem statements.');
  }
}
