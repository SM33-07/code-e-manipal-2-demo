import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import { isValidUUID } from '@/lib/utils/validate';

/**
 * GET /api/judging/assignments
 * Judge/Admin — returns the current judge's assigned submissions
 * with a `reviewed` boolean based on whether this judge has completed a review.
 */
export const GET = withAuth(async (req, { user, profile }) => {
  try {
    const isAdmin = profile?.role === 'admin';
    const requestedSubmissionId = req.nextUrl.searchParams.get('submission_id');
    if (requestedSubmissionId && !isValidUUID(requestedSubmissionId)) {
      return Errors.BAD_REQUEST('Invalid submission_id');
    }

    let sql = '';
    const params: (string | null)[] = [user.id];

    if (isAdmin) {
      // Admins see all submissions
      sql = `
        SELECT 
          $1::uuid AS judge_id,
          s.id AS submission_id,
          json_build_object(
            'id', s.id,
            'title', s.title,
            'summary', s.summary,
            'description', s.description,
            'category', s.category,
            'technologies', s.technologies,
            'github_url', s.github_url,
            'demo_url', s.demo_url,
            'docs_url', s.docs_url,
            'demo_video_url', s.demo_video_url,
            'status', s.status,
            'submitted_at', s.submitted_at,
            'created_at', s.created_at,
            'updated_at', s.updated_at,
            'track', t.track,
            'teams', json_build_object('name', t.name, 'track', t.track)
            ) AS submissions,
            (
              SELECT json_build_object(
                'id', jr.id,
                'is_complete', jr.is_complete,
                'version', jr.version,
                'score_innovation', jr.score_innovation,
                'score_technical', jr.score_technical,
                'score_presentation', jr.score_presentation,
                'score_impact', jr.score_impact,
                'feedback', jr.feedback,
                'updated_at', jr.updated_at
              )
              FROM public.judge_reviews jr
              WHERE jr.submission_id = s.id AND jr.judge_id = $1
              LIMIT 1
            ) AS review,
            EXISTS(
              SELECT 1 FROM public.judge_reviews jr
              WHERE jr.submission_id = s.id AND jr.judge_id = $1 AND jr.is_complete = true
            ) AS reviewed
        FROM public.submissions s
        JOIN public.teams t ON t.id = s.team_id
        WHERE s.deleted_at IS NULL
            AND ($2::uuid IS NULL OR s.id = $2)
        ORDER BY s.created_at DESC;
      `;
      params.push(requestedSubmissionId ?? null);
    } else {
      // Judges only see assigned submissions
      sql = `
        SELECT 
          ja.judge_id,
          ja.submission_id,
          ja.assigned_at,
          json_build_object(
            'id', s.id,
            'title', s.title,
            'summary', s.summary,
            'description', s.description,
            'category', s.category,
            'technologies', s.technologies,
            'github_url', s.github_url,
            'demo_url', s.demo_url,
            'docs_url', s.docs_url,
            'demo_video_url', s.demo_video_url,
            'status', s.status,
            'submitted_at', s.submitted_at,
            'created_at', s.created_at,
            'updated_at', s.updated_at,
            'track', t.track,
            'teams', json_build_object('name', t.name, 'track', t.track)
          ) AS submissions,
          (
            SELECT json_build_object(
              'id', jr.id,
              'is_complete', jr.is_complete,
              'version', jr.version,
              'score_innovation', jr.score_innovation,
              'score_technical', jr.score_technical,
              'score_presentation', jr.score_presentation,
              'score_impact', jr.score_impact,
              'feedback', jr.feedback,
              'updated_at', jr.updated_at
            )
            FROM public.judge_reviews jr
            WHERE jr.submission_id = ja.submission_id AND jr.judge_id = ja.judge_id
            LIMIT 1
          ) AS review,
          EXISTS(
            SELECT 1 FROM public.judge_reviews jr
            WHERE jr.submission_id = ja.submission_id AND jr.judge_id = ja.judge_id
              AND jr.is_complete = true
          ) AS reviewed
        FROM public.judge_assignments ja
        JOIN public.submissions s ON s.id = ja.submission_id
        JOIN public.teams t ON t.id = s.team_id
        WHERE ja.judge_id = $1 AND s.deleted_at IS NULL
          AND ($2::uuid IS NULL OR s.id = $2)
        ORDER BY ja.assigned_at DESC;
      `;
      params.push(requestedSubmissionId ?? null);
    }

    const { rows } = await query(sql, params);

    // Optional status filter
    const status = req.nextUrl.searchParams.get('status');
    const filtered = status
      ? rows.filter(i => i.submissions?.status === status)
      : rows;

    logger.info('GET /api/judging/assignments', {
      userId: user.id,
      total:  filtered.length,
    });

    return successResponse(filtered, {
      total:     filtered.length,
      completed: filtered.filter((i: any) => i.reviewed).length,
    });
  } catch (err) {
    logger.error('GET /api/judging/assignments', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'judge');
