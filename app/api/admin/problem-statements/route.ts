import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';

export const OFFICIAL_TRACKS = [
  'Artificial Intelligence and Machine Learning (AI/ML)',
  'HealthTech',
  'FinTech and EdTech',
  'Cybersecurity',
  'Generative AI and Large Language Models (LLMs)',
  'Multi-Agent Systems',
  'Gaming and Immersive Technology',
  'Smart City and Infrastructure',
  'Open Innovation',
];

/**
 * GET /api/admin/problem-statements
 * Returns all problem statements (draft and published) with event configuration.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const trackFilter = url.searchParams.get('track');
  const statusFilter = url.searchParams.get('status'); // 'published', 'draft'

  let query = `
    SELECT id, title, track, description, requirements, deliverables,
           constraints, attachment_url, attachment_name, is_published,
           display_order, created_at, updated_at
    FROM public.problem_statements
    WHERE 1=1
  `;
  const params: any[] = [];

  if (trackFilter) {
    params.push(trackFilter);
    query += ` AND track = $${params.length}`;
  }
  if (statusFilter === 'published') {
    query += ` AND is_published = true`;
  } else if (statusFilter === 'draft') {
    query += ` AND is_published = false`;
  }

  query += ` ORDER BY display_order ASC, id ASC;`;

  const { rows: statements } = await pool.query(query, params);

  const { rows: configRows } = await pool.query(`
    SELECT problem_statements_published, problem_selection_start, problem_selection_end
    FROM public.event_config
    WHERE id = 1;
  `);

  return successResponse({
    config: configRows[0] || null,
    officialTracks: OFFICIAL_TRACKS,
    statements,
  });
}, 'admin');

/**
 * POST /api/admin/problem-statements
 * Creates a new problem statement draft or published item.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid JSON payload.');
  }

  const {
    id,
    title,
    track,
    description,
    requirements = [],
    deliverables = [],
    constraints = null,
    attachment_url = null,
    attachment_name = null,
    is_published = false,
    display_order = 0,
  } = body;

  if (!id || !title || !track || !description) {
    return Errors.BAD_REQUEST('ID, Title, Track, and Description are required fields.');
  }

  const cleanId = String(id).trim().toUpperCase();
  const cleanTrack = String(track).trim();

  // Validate track
  if (!OFFICIAL_TRACKS.includes(cleanTrack)) {
    return Errors.BAD_REQUEST(`Invalid track. Must be one of the official tracks.`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check unique ID
    const { rows: existing } = await client.query(
      'SELECT id FROM public.problem_statements WHERE id = $1',
      [cleanId]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return Errors.CONFLICT(`Problem Statement with ID "${cleanId}" already exists.`);
    }

    const { rows: created } = await client.query(`
      INSERT INTO public.problem_statements (
        id, title, track, description, requirements, deliverables,
        constraints, attachment_url, attachment_name, is_published, display_order
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)
      RETURNING *;
    `, [
      cleanId,
      title.trim(),
      cleanTrack,
      description.trim(),
      JSON.stringify(Array.isArray(requirements) ? requirements : [requirements]),
      JSON.stringify(Array.isArray(deliverables) ? deliverables : [deliverables]),
      constraints?.trim() || null,
      attachment_url?.trim() || null,
      attachment_name?.trim() || null,
      Boolean(is_published),
      Number(display_order) || 0,
    ]);

    await client.query('COMMIT');

    logAudit({
      userId: user.id,
      action: 'PROBLEM_STATEMENT_CREATED',
      targetTable: 'problem_statements',
      targetId: cleanId,
      details: { title, track: cleanTrack, is_published },
    });

    return successResponse({ statement: created[0] }, undefined, 201);
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to create problem statement: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
