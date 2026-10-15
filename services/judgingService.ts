import { query } from '@/lib/db';
import type { JudgeReview, JudgeAssignment } from '@/types';

/**
 * Get the assignments assigned to a specific judge
 */
export async function getJudgeAssignments(judgeId: string): Promise<JudgeAssignment[]> {
  const res = await query(
    `SELECT 
       ja.*,
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
         'teams', json_build_object('name', t.name)
       ) AS submissions
     FROM public.judge_assignments ja
     JOIN public.submissions s ON s.id = ja.submission_id
     JOIN public.teams t ON t.id = s.team_id
     WHERE ja.judge_id = $1`,
    [judgeId]
  );
  return res.rows as JudgeAssignment[];
}

/**
 * Create or update (upsert) a judge review
 */
export async function upsertReview(
  review: Partial<JudgeReview> & { submission_id: string; judge_id: string }
): Promise<JudgeReview> {
  const res = await query(
    `INSERT INTO public.judge_reviews (
       submission_id, judge_id, score_innovation, score_technical, score_presentation, score_impact, feedback, is_complete
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (submission_id, judge_id) DO UPDATE SET
       score_innovation = EXCLUDED.score_innovation,
       score_technical = EXCLUDED.score_technical,
       score_presentation = EXCLUDED.score_presentation,
       score_impact = EXCLUDED.score_impact,
       feedback = EXCLUDED.feedback,
       is_complete = EXCLUDED.is_complete,
       updated_at = NOW()
     RETURNING *`,
    [
      review.submission_id,
      review.judge_id,
      review.score_innovation || null,
      review.score_technical || null,
      review.score_presentation || null,
      review.score_impact || null,
      review.feedback || null,
      review.is_complete || false,
    ]
  );
  return res.rows[0] as JudgeReview;
}

/**
 * Get all complete/draft reviews for a specific submission
 */
export async function getReviewsForSubmission(submissionId: string): Promise<JudgeReview[]> {
  const res = await query(
    `SELECT 
       jr.*,
       json_build_object('name', p.name) AS profiles
     FROM public.judge_reviews jr
     JOIN public.profiles p ON p.id = jr.judge_id
     WHERE jr.submission_id = $1`,
    [submissionId]
  );
  return res.rows as JudgeReview[];
}

/**
 * Manually assign a judge to a submission
 */
export async function assignJudge(judgeId: string, submissionId: string): Promise<void> {
  await query(
    'INSERT INTO public.judge_assignments (judge_id, submission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [judgeId, submissionId]
  );
}

/**
 * Manually unassign a judge from a submission
 */
export async function removeJudgeAssignment(judgeId: string, submissionId: string): Promise<void> {
  await query(
    'DELETE FROM public.judge_assignments WHERE judge_id = $1 AND submission_id = $2',
    [judgeId, submissionId]
  );
}

// Utility to shuffle array randomly
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Auto-assign all active judges to all submitted assignments round-robin
 */
export async function autoAssignAllJudges(): Promise<number> {
  // Get all active judges
  const judgeRes = await query("SELECT id FROM public.profiles WHERE role = 'judge' AND is_disabled = false");
  const judges = judgeRes.rows;
  if (!judges || judges.length === 0) return 0;

  // Get all submitted (non-draft, non-deleted) submissions
  const subRes = await query(
    "SELECT id FROM public.submissions WHERE status IN ('submitted', 'under_review', 'reviewed') AND deleted_at IS NULL"
  );
  const submissions = subRes.rows;
  if (!submissions || submissions.length === 0) return 0;

  // Shuffle submissions randomly
  const shuffled = shuffleArray(submissions);

  // Build assignments round-robin
  const assignments = shuffled.map((sub, i) => ({
    judge_id: judges[i % judges.length].id,
    submission_id: sub.id,
  }));

  const subIds = submissions.map((s) => s.id);
  
  // Clear existing assignments for these submissions
  await query('DELETE FROM public.judge_assignments WHERE submission_id = ANY($1::uuid[])', [subIds]);

  // Bulk insert new assignments in a single parameterized multi-row query
  if (assignments.length > 0) {
    const values: any[] = [];
    const valueClauses = assignments.map((a, idx) => {
      values.push(a.judge_id, a.submission_id);
      return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
    });

    await query(
      `INSERT INTO public.judge_assignments (judge_id, submission_id)
       VALUES ${valueClauses.join(', ')}
       ON CONFLICT DO NOTHING`,
      values
    );
  }

  return assignments.length;
}

/**
 * Fetch a single review by review ID and judge ID
 */
export async function getReviewById(id: string, userId: string): Promise<JudgeReview | null> {
  const res = await query(
    'SELECT * FROM public.judge_reviews WHERE id = $1 AND judge_id = $2 LIMIT 1',
    [id, userId]
  );
  return (res.rows[0] as JudgeReview) || null;
}

/**
 * Update score/feedback updates on an existing review
 */
export async function updateReview(
  id: string,
  userId: string,
  updates: Record<string, unknown>
): Promise<JudgeReview> {
  const keys = Object.keys(updates);
  if (keys.length === 0) {
    const current = await getReviewById(id, userId);
    if (!current) throw new Error('Review not found');
    return current;
  }

  const setClause = keys.map((key, index) => `"${key}" = $${index + 3}`).join(', ');
  const values = keys.map((key) => updates[key]);

  const res = await query(
    `UPDATE public.judge_reviews SET ${setClause} WHERE id = $1 AND judge_id = $2 RETURNING *`,
    [id, userId, ...values]
  );
  const updated = res.rows[0];
  if (!updated) throw new Error('Review not found for update');

  return updated as JudgeReview;
}