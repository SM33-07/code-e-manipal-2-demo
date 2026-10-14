/**
 * Problem Statement CMS & Versioned Release Service (Phase 3 Requirements A-D)
 * File: services/problemStatementService.ts
 *
 * Implements:
 * 1. Versioned releases with explicit published pointer (public.problem_statement_releases)
 * 2. Version-scoped drafts and review status tracking (public.problem_statement_drafts)
 * 3. Atomic publication and withdrawal transactions
 * 4. Strict isolation of drafts, held items, and proposals from unauthenticated/participant callers
 * 5. Full audit logging of creation, edit, approval, publication, and unpublication events
 */

import { pool, query } from '../lib/db.ts';
import { logger } from '../lib/utils/logger.ts';

export interface ProblemStatementRelease {
  id: string;
  version_number: number;
  label: string;
  status: 'draft' | 'published' | 'archived' | 'withdrawn';
  is_current_published: boolean;
  created_by?: string | null;
  published_by?: string | null;
  published_at?: string | null;
  withdrawn_at?: string | null;
  created_at: string;
  updated_at: string;
  release_notes?: string | null;
  stats?: {
    total_drafts: number;
    approved_drafts: number;
    held_drafts: number;
    new_proposals: number;
  };
}

export interface ProblemStatementDraft {
  id: string;
  release_id: string;
  challenge_num: number;
  track_num: string;
  track: string;
  original_ref_id: string;
  proposed_id: string;
  title: string;
  difficulty: string;
  build_type: string;
  review_status: string;
  category_state: 'selected' | 'hold' | 'new_proposal';
  is_approved_for_release: boolean;
  is_official_sih: boolean;
  scope_note?: string | null;
  problem_statement: string;
  implementation_challenge: string;
  minimum_acceptable_prototype: string;
  evaluation_tests: string;
  stretch_differentiator: string;
  suggested_public_sector_relevance?: string | null;
  slug?: string | null;
  description_implementation?: string | null;
  deliverables?: string | null;
  description_bullets?: string[];
  deliverables_bullets?: string[];
  additional_guidance?: Record<string, any>;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicProblemStatement {
  id: string; // proposed_id (e.g. PS 01)
  challenge_num: number;
  track_num: string;
  track: string;
  original_ref_id: string;
  slug: string;
  title: string;
  difficulty: string;
  build_type: string;
  is_official_sih: boolean;
  scope_note?: string | null;
  problem_statement: string;
  description_implementation?: string | null;
  description_bullets?: string[];
  deliverables?: string | null;
  deliverables_bullets?: string[];
  implementation_challenge: string;
  minimum_acceptable_prototype: string;
  evaluation_tests: string;
  stretch_differentiator: string;
  suggested_public_sector_relevance?: string | null;
  additional_guidance?: Record<string, any>;
  display_order: number;
}

export interface PublicProblemStatementsResponse {
  isPublished: boolean;
  release?: {
    version: number;
    label: string;
    published_at: string;
  } | null;
  statements: PublicProblemStatement[];
  tracks: string[];
}

/**
 * Public Data Access: Returns ONLY the currently published release and ONLY approved statements.
 * Completely excludes internal review notes, held items, and unapproved proposals.
 */
export async function getPublicProblemStatements(): Promise<PublicProblemStatementsResponse> {
  const { rows: configRows } = await query(`
    SELECT problem_statements_published, active_problem_release_id
    FROM public.event_config
    WHERE id = 1;
  `);

  const isGloballyPublished = configRows.length > 0 && configRows[0].problem_statements_published === true;
  if (!isGloballyPublished) {
    return { isPublished: false, release: null, statements: [], tracks: [] };
  }

  // Find the currently published release
  const { rows: releaseRows } = await query(`
    SELECT id, version_number, label, published_at
    FROM public.problem_statement_releases
    WHERE is_current_published = TRUE AND status = 'published'
    LIMIT 1;
  `);

  if (releaseRows.length === 0) {
    return { isPublished: false, release: null, statements: [], tracks: [] };
  }

  const currentRelease = releaseRows[0];

  // Fetch only approved statements for this release
  const { rows: draftRows } = await query(`
    SELECT id, challenge_num, track_num, track, original_ref_id, proposed_id,
           COALESCE(slug, LOWER(REPLACE(proposed_id, ' ', '-'))) as slug,
           title, difficulty, build_type, is_official_sih, scope_note,
           problem_statement, description_implementation, description_bullets,
           deliverables, deliverables_bullets, implementation_challenge,
           minimum_acceptable_prototype, evaluation_tests, stretch_differentiator,
           suggested_public_sector_relevance, additional_guidance, display_order
    FROM public.problem_statement_drafts
    WHERE release_id = $1 AND is_approved_for_release = TRUE
    ORDER BY display_order ASC, challenge_num ASC;
  `, [currentRelease.id]);

  const statements: PublicProblemStatement[] = draftRows.map((d: any) => ({
    id: d.proposed_id,
    challenge_num: d.challenge_num,
    track_num: d.track_num,
    track: d.track,
    original_ref_id: d.original_ref_id,
    slug: d.slug || `ps-${String(d.challenge_num).padStart(2, '0')}`,
    title: d.title,
    difficulty: d.difficulty,
    build_type: d.build_type,
    is_official_sih: d.is_official_sih,
    scope_note: d.scope_note,
    problem_statement: d.problem_statement,
    description_implementation: d.description_implementation || d.implementation_challenge,
    description_bullets: Array.isArray(d.description_bullets) ? d.description_bullets : [],
    deliverables: d.deliverables || d.minimum_acceptable_prototype,
    deliverables_bullets: Array.isArray(d.deliverables_bullets) ? d.deliverables_bullets : [],
    implementation_challenge: d.implementation_challenge,
    minimum_acceptable_prototype: d.minimum_acceptable_prototype,
    evaluation_tests: d.evaluation_tests,
    stretch_differentiator: d.stretch_differentiator,
    suggested_public_sector_relevance: d.suggested_public_sector_relevance,
    additional_guidance: d.additional_guidance || {},
    display_order: d.display_order,
  }));

  const tracks = Array.from(new Set(statements.map((s) => s.track))).filter(Boolean);

  return {
    isPublished: true,
    release: {
      version: currentRelease.version_number,
      label: currentRelease.label,
      published_at: currentRelease.published_at ? new Date(currentRelease.published_at).toISOString() : new Date().toISOString(),
    },
    statements,
    tracks,
  };
}

export interface ProblemDetailResponse {
  statement: PublicProblemStatement;
  previousProblem?: { slug: string; id: string; title: string } | null;
  nextProblem?: { slug: string; id: string; title: string } | null;
}

/**
 * Public Data Access: Returns a single approved statement from the current release by slug or ID.
 */
export async function getPublicProblemStatementBySlugOrId(
  slugOrId: string
): Promise<ProblemDetailResponse | null> {
  const { isPublished, statements } = await getPublicProblemStatements();
  if (!isPublished || statements.length === 0) return null;

  const clean = decodeURIComponent(slugOrId).trim().toLowerCase();
  const cleanId = clean.replace(/-/g, ' ').toUpperCase(); // e.g. "ps-01" -> "PS 01"
  const cleanCompact = clean.replace(/[^a-z0-9]/g, ''); // e.g. "ps01"
  const psPrefixMatch = clean.match(/^ps-?0?(\d+)/i);
  const psNum = psPrefixMatch ? parseInt(psPrefixMatch[1], 10) : null;

  const index = statements.findIndex((s) => {
    const sSlug = s.slug.toLowerCase();
    const sId = s.id.toLowerCase();
    const sIdCompact = s.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      sSlug === clean ||
      sId === clean ||
      s.id === cleanId ||
      sIdCompact === cleanCompact ||
      sSlug.startsWith(`${clean}-`) ||
      clean.startsWith(`${sSlug}-`) ||
      (psNum !== null && s.challenge_num === psNum)
    );
  });

  if (index === -1) return null;

  const statement = statements[index];
  const previousProblem =
    index > 0
      ? {
          slug: statements[index - 1].slug,
          id: statements[index - 1].id,
          title: statements[index - 1].title,
        }
      : null;

  const nextProblem =
    index < statements.length - 1
      ? {
          slug: statements[index + 1].slug,
          id: statements[index + 1].id,
          title: statements[index + 1].title,
        }
      : null;

  return {
    statement,
    previousProblem,
    nextProblem,
  };
}

/**
 * Admin Data Access: Returns all releases with aggregate draft statistics.
 */
export async function getAdminReleases(): Promise<ProblemStatementRelease[]> {
  const { rows } = await query(`
    SELECT r.*,
           COUNT(d.id)::int as total_drafts,
           COUNT(d.id) FILTER (WHERE d.is_approved_for_release = TRUE)::int as approved_drafts,
           COUNT(d.id) FILTER (WHERE d.category_state = 'hold')::int as held_drafts,
           COUNT(d.id) FILTER (WHERE d.category_state = 'new_proposal')::int as new_proposals
    FROM public.problem_statement_releases r
    LEFT JOIN public.problem_statement_drafts d ON d.release_id = r.id
    GROUP BY r.id
    ORDER BY r.version_number DESC;
  `);

  return rows.map((r: any) => ({
    ...r,
    stats: {
      total_drafts: r.total_drafts || 0,
      approved_drafts: r.approved_drafts || 0,
      held_drafts: r.held_drafts || 0,
      new_proposals: r.new_proposals || 0,
    },
  }));
}

/**
 * Admin Data Access: Returns detail for a specific release and all its drafts.
 */
export async function getAdminReleaseDetail(releaseId: string): Promise<{
  release: ProblemStatementRelease | null;
  drafts: ProblemStatementDraft[];
}> {
  const { rows: relRows } = await query(`
    SELECT r.*,
           COUNT(d.id)::int as total_drafts,
           COUNT(d.id) FILTER (WHERE d.is_approved_for_release = TRUE)::int as approved_drafts,
           COUNT(d.id) FILTER (WHERE d.category_state = 'hold')::int as held_drafts,
           COUNT(d.id) FILTER (WHERE d.category_state = 'new_proposal')::int as new_proposals
    FROM public.problem_statement_releases r
    LEFT JOIN public.problem_statement_drafts d ON d.release_id = r.id
    WHERE r.id = $1
    GROUP BY r.id;
  `, [releaseId]);

  if (relRows.length === 0) {
    return { release: null, drafts: [] };
  }

  const { rows: drafts } = await query(`
    SELECT *
    FROM public.problem_statement_drafts
    WHERE release_id = $1
    ORDER BY display_order ASC, challenge_num ASC;
  `, [releaseId]);

  const release = {
    ...relRows[0],
    stats: {
      total_drafts: relRows[0].total_drafts || 0,
      approved_drafts: relRows[0].approved_drafts || 0,
      held_drafts: relRows[0].held_drafts || 0,
      new_proposals: relRows[0].new_proposals || 0,
    },
  };

  return { release, drafts };
}

/**
 * Admin Action: Edit an individual draft statement.
 */
export async function updateDraftStatement(
  draftId: string,
  updates: Partial<ProblemStatementDraft>,
  actorId?: string,
  actorEmail?: string
): Promise<ProblemStatementDraft> {
  const {
    title,
    difficulty,
    build_type,
    review_status,
    category_state,
    is_approved_for_release,
    scope_note,
    problem_statement,
    implementation_challenge,
    minimum_acceptable_prototype,
    evaluation_tests,
    stretch_differentiator,
    suggested_public_sector_relevance,
    slug,
    description_implementation,
    deliverables,
    description_bullets,
    deliverables_bullets,
    additional_guidance,
    display_order,
  } = updates;

  if (title !== undefined && !title.trim()) {
    throw new Error('Title cannot be empty');
  }
  if (problem_statement !== undefined && !problem_statement.trim()) {
    throw new Error('Problem statement text cannot be empty');
  }

  const { rows } = await query(`
    UPDATE public.problem_statement_drafts
    SET title = COALESCE($1, title),
        difficulty = COALESCE($2, difficulty),
        build_type = COALESCE($3, build_type),
        review_status = COALESCE($4, review_status),
        category_state = COALESCE($5, category_state),
        is_approved_for_release = COALESCE($6, is_approved_for_release),
        scope_note = COALESCE($7, scope_note),
        problem_statement = COALESCE($8, problem_statement),
        implementation_challenge = COALESCE($9, implementation_challenge),
        minimum_acceptable_prototype = COALESCE($10, minimum_acceptable_prototype),
        evaluation_tests = COALESCE($11, evaluation_tests),
        stretch_differentiator = COALESCE($12, stretch_differentiator),
        suggested_public_sector_relevance = COALESCE($13, suggested_public_sector_relevance),
        slug = COALESCE($14, slug),
        description_implementation = COALESCE($15, description_implementation),
        deliverables = COALESCE($16, deliverables),
        description_bullets = COALESCE($17, description_bullets),
        deliverables_bullets = COALESCE($18, deliverables_bullets),
        additional_guidance = COALESCE($19, additional_guidance),
        display_order = COALESCE($20, display_order),
        updated_at = NOW()
    WHERE id = $21
    RETURNING *;
  `, [
    title,
    difficulty,
    build_type,
    review_status,
    category_state,
    is_approved_for_release,
    scope_note,
    problem_statement,
    implementation_challenge,
    minimum_acceptable_prototype,
    evaluation_tests,
    stretch_differentiator,
    suggested_public_sector_relevance,
    slug,
    description_implementation,
    deliverables,
    description_bullets ? JSON.stringify(description_bullets) : null,
    deliverables_bullets ? JSON.stringify(deliverables_bullets) : null,
    additional_guidance ? JSON.stringify(additional_guidance) : null,
    display_order,
    draftId,
  ]);

  if (rows.length === 0) {
    throw new Error(`Draft ${draftId} not found`);
  }

  const updatedDraft = rows[0];

  // Audit log
  await query(`
    INSERT INTO public.problem_statement_audit_logs (
      action, release_id, draft_id, actor_id, actor_email, metadata
    ) VALUES (
      'UPDATE_DRAFT', $1, $2, $3, $4, $5::jsonb
    );
  `, [
    updatedDraft.release_id,
    draftId,
    actorId || null,
    actorEmail || null,
    JSON.stringify({ proposed_id: updatedDraft.proposed_id, fields_updated: Object.keys(updates) }),
  ]);

  return updatedDraft;
}

/**
 * Admin Action: Toggle approval state of a draft item for release inclusion.
 */
export async function toggleDraftApproval(
  draftId: string,
  isApproved: boolean,
  actorId?: string,
  actorEmail?: string
): Promise<ProblemStatementDraft> {
  const { rows } = await query(`
    UPDATE public.problem_statement_drafts
    SET is_approved_for_release = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `, [isApproved, draftId]);

  if (rows.length === 0) {
    throw new Error(`Draft ${draftId} not found`);
  }

  const updated = rows[0];

  await query(`
    INSERT INTO public.problem_statement_audit_logs (
      action, release_id, draft_id, actor_id, actor_email, metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6::jsonb
    );
  `, [
    isApproved ? 'APPROVE_DRAFT' : 'UNAPPROVE_DRAFT',
    updated.release_id,
    draftId,
    actorId || null,
    actorEmail || null,
    JSON.stringify({ proposed_id: updated.proposed_id, is_approved: isApproved }),
  ]);

  return updated;
}

/**
 * Admin Action: Create a new draft release version, optionally cloning drafts from a previous release.
 */
export async function createDraftRelease(
  label: string,
  sourceReleaseId?: string,
  releaseNotes?: string,
  actorId?: string,
  actorEmail?: string
): Promise<ProblemStatementRelease> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Determine next version number
    const { rows: verRows } = await client.query(`
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver
      FROM public.problem_statement_releases;
    `);
    const nextVer = verRows[0].next_ver;

    const { rows: newRel } = await client.query(`
      INSERT INTO public.problem_statement_releases (
        version_number, label, status, is_current_published,
        created_by, release_notes
      ) VALUES (
        $1, $2, 'draft', FALSE, $3, $4
      ) RETURNING *;
    `, [nextVer, label.trim(), actorId || null, releaseNotes || null]);

    const createdRelease = newRel[0];

    // Clone drafts from source release if requested
    if (sourceReleaseId) {
      const { rows: sourceDrafts } = await client.query(`
        SELECT * FROM public.problem_statement_drafts WHERE release_id = $1 ORDER BY display_order ASC;
      `, [sourceReleaseId]);

      for (const d of sourceDrafts) {
        await client.query(`
          INSERT INTO public.problem_statement_drafts (
            release_id, challenge_num, track_num, track, original_ref_id,
            proposed_id, title, difficulty, build_type, review_status,
            category_state, is_approved_for_release, is_official_sih,
            scope_note, problem_statement, implementation_challenge,
            minimum_acceptable_prototype, evaluation_tests,
            stretch_differentiator, suggested_public_sector_relevance,
            display_order
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13,
            $14, $15, $16,
            $17, $18,
            $19, $20,
            $21
          );
        `, [
          createdRelease.id,
          d.challenge_num,
          d.track_num,
          d.track,
          d.original_ref_id,
          d.proposed_id,
          d.title,
          d.difficulty,
          d.build_type,
          d.review_status,
          d.category_state,
          d.is_approved_for_release,
          d.is_official_sih,
          d.scope_note,
          d.problem_statement,
          d.implementation_challenge,
          d.minimum_acceptable_prototype,
          d.evaluation_tests,
          d.stretch_differentiator,
          d.suggested_public_sector_relevance,
          d.display_order,
        ]);
      }
    }

    await client.query(`
      INSERT INTO public.problem_statement_audit_logs (
        action, release_id, actor_id, actor_email, metadata
      ) VALUES (
        'CREATE_RELEASE', $1, $2, $3, $4::jsonb
      );
    `, [
      createdRelease.id,
      actorId || null,
      actorEmail || null,
      JSON.stringify({ version_number: nextVer, label, cloned_from: sourceReleaseId || null }),
    ]);

    await client.query('COMMIT');
    return createdRelease;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin Action: Atomically publish an approved release.
 * Ensures single published release invariant and synchronizes event_config.
 */
export async function publishRelease(
  releaseId: string,
  actorId?: string,
  actorEmail?: string
): Promise<ProblemStatementRelease> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock release and event_config
    const { rows: relRows } = await client.query(`
      SELECT * FROM public.problem_statement_releases WHERE id = $1 FOR UPDATE;
    `, [releaseId]);

    if (relRows.length === 0) {
      throw new Error('Release not found');
    }

    // 2. Verify release has at least one approved item
    const { rows: approvedCount } = await client.query(`
      SELECT COUNT(*)::int as count FROM public.problem_statement_drafts
      WHERE release_id = $1 AND is_approved_for_release = TRUE;
    `, [releaseId]);

    if (!approvedCount[0] || approvedCount[0].count === 0) {
      throw new Error('Cannot publish release: no approved challenge briefs found in this release');
    }

    // 3. Mark all other releases as not current published
    await client.query(`
      UPDATE public.problem_statement_releases
      SET is_current_published = FALSE,
          updated_at = NOW()
      WHERE id != $1 AND is_current_published = TRUE;
    `, [releaseId]);

    // 4. Mark this release as published
    const { rows: updatedRel } = await client.query(`
      UPDATE public.problem_statement_releases
      SET is_current_published = TRUE,
          status = 'published',
          published_at = NOW(),
          published_by = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `, [actorId || null, releaseId]);

    // 5. Synchronize event_config
    await client.query(`
      UPDATE public.event_config
      SET problem_statements_published = TRUE,
          active_problem_release_id = $1,
          updated_at = NOW()
      WHERE id = 1;
    `, [releaseId]);

    // 6. Audit log
    await client.query(`
      INSERT INTO public.problem_statement_audit_logs (
        action, release_id, actor_id, actor_email, metadata
      ) VALUES (
        'PUBLISH_RELEASE', $1, $2, $3, $4::jsonb
      );
    `, [
      releaseId,
      actorId || null,
      actorEmail || null,
      JSON.stringify({
        version_number: updatedRel[0].version_number,
        approved_count: approvedCount[0].count,
      }),
    ]);

    await client.query('COMMIT');
    logger.info('Problem statement release published successfully', { releaseId, version: updatedRel[0].version_number });
    return updatedRel[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin Action: Emergency Unpublish.
 * Atomically marks release as withdrawn, clears active pointer, and sets problem_statements_published = FALSE.
 */
export async function unpublishRelease(
  releaseId: string,
  actorId?: string,
  actorEmail?: string
): Promise<ProblemStatementRelease> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updatedRel } = await client.query(`
      UPDATE public.problem_statement_releases
      SET is_current_published = FALSE,
          status = 'withdrawn',
          withdrawn_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `, [releaseId]);

    if (updatedRel.length === 0) {
      throw new Error('Release not found');
    }

    // Set event_config problem_statements_published = FALSE
    await client.query(`
      UPDATE public.event_config
      SET problem_statements_published = FALSE,
          active_problem_release_id = NULL,
          updated_at = NOW()
      WHERE id = 1;
    `);

    await client.query(`
      INSERT INTO public.problem_statement_audit_logs (
        action, release_id, actor_id, actor_email, metadata
      ) VALUES (
        'UNPUBLISH_RELEASE', $1, $2, $3, $4::jsonb
      );
    `, [
      releaseId,
      actorId || null,
      actorEmail || null,
      JSON.stringify({ version_number: updatedRel[0].version_number }),
    ]);

    await client.query('COMMIT');
    logger.info('Problem statement release unpublished (emergency withdrawal)', { releaseId });
    return updatedRel[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin Data Access: Returns audit history.
 */
export async function getAdminAuditLogs(limit = 50) {
  const { rows } = await query(`
    SELECT a.*, p.name as actor_name
    FROM public.problem_statement_audit_logs a
    LEFT JOIN public.profiles p ON p.id = a.actor_id
    ORDER BY a.created_at DESC
    LIMIT $1;
  `, [limit]);
  return rows;
}
