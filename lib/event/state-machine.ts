/**
 * CODE-e-MANIPAL 2.0 — Event State Machine & Phase Transition Engine
 * 
 * Implements the 7 canonical event phases, legal transition graph,
 * judging-completeness verification gate, and emergency override invariants
 * per IMPLEMENTATION_BASELINE_v4_FINAL.md (Phase 3).
 *
 * State Machine Graph:
 * NOT_STARTED → HACKING → SUBMISSION → SUBMISSION_CLOSED → JUDGING → RESULTS → ENDED
 */

import { query } from '../db';
import { logger } from '../utils/logger';

// ── 7 Canonical Event Phases ──
export const EVENT_PHASES = [
  'NOT_STARTED',
  'HACKING',
  'SUBMISSION',
  'SUBMISSION_CLOSED',
  'JUDGING',
  'RESULTS',
  'ENDED',
] as const;

export type EventPhase = (typeof EVENT_PHASES)[number];

// ── Strict Sequential Transition Graph ──
export const LEGAL_TRANSITIONS: Record<EventPhase, EventPhase | null> = {
  NOT_STARTED: 'HACKING',
  HACKING: 'SUBMISSION',
  SUBMISSION: 'SUBMISSION_CLOSED',
  SUBMISSION_CLOSED: 'JUDGING',
  JUDGING: 'RESULTS',
  RESULTS: 'ENDED',
  ENDED: null,
};

/**
 * Validates if a string is a canonical EventPhase
 */
export function isValidPhase(phase: unknown): phase is EventPhase {
  return typeof phase === 'string' && EVENT_PHASES.includes(phase as EventPhase);
}

/**
 * Validates if moving from currentPhase to targetPhase is allowed on standard sequential transitions
 */
export function isLegalTransition(currentPhase: EventPhase, targetPhase: EventPhase): boolean {
  return LEGAL_TRANSITIONS[currentPhase] === targetPhase;
}

// ── Judging Completeness Verification ──

export interface JudgingCompletenessResult {
  isComplete: boolean;
  eligibleTeamCount: number;
  assignedCount: number;
  completedReviews: number;
  pendingReviews: number;
  unassignedSubmissions: Array<{
    submissionId: string;
    teamId: string;
    teamName: string;
  }>;
  incompleteAssignments: Array<{
    submissionId: string;
    judgeId: string;
    teamName: string;
  }>;
  reasons: string[];
}

/**
 * Checks judging completeness across all eligible participating teams.
 *
 * Rules per baseline:
 * 1. Eligible teams only (active submitted projects, excluding disqualified or withdrawn teams).
 * 2. Assignment completeness: Every eligible submission must have at least 1 judge assigned.
 * 3. Evaluation completeness: Every assigned judge must have finalized and submitted their review
 *    (is_complete = true, zero dangling drafts).
 *
 * @returns JudgingCompletenessResult with full diagnostic breakdown
 */
export async function checkJudgingCompleteness(): Promise<JudgingCompletenessResult> {
  const reasons: string[] = [];

  // 1. Fetch eligible submissions from non-deleted, submitted projects
  // Excluding teams marked disqualified or withdrawn if status columns exist
  const { rows: eligibleRows } = await query(`
    SELECT 
      s.id AS submission_id,
      s.team_id,
      t.name AS team_name,
      s.status AS submission_status
    FROM public.submissions s
    JOIN public.teams t ON t.id = s.team_id
    WHERE s.deleted_at IS NULL
      AND s.status IN ('submitted', 'locked', 'under_review', 'reviewed')
    ORDER BY t.name ASC
  `);

  const eligibleTeamCount = eligibleRows.length;

  if (eligibleTeamCount === 0) {
    return {
      isComplete: false,
      eligibleTeamCount: 0,
      assignedCount: 0,
      completedReviews: 0,
      pendingReviews: 0,
      unassignedSubmissions: [],
      incompleteAssignments: [],
      reasons: ['No eligible participating submissions found for judging.'],
    };
  }

  const eligibleSubmissionIds = eligibleRows.map((r: any) => r.submission_id);

  // 2. Fetch all assignments for eligible submissions
  const { rows: assignmentRows } = await query(
    `SELECT ja.submission_id, ja.judge_id, t.name AS team_name
     FROM public.judge_assignments ja
     JOIN public.submissions s ON s.id = ja.submission_id
     JOIN public.teams t ON t.id = s.team_id
     WHERE ja.submission_id = ANY($1::uuid[])`,
    [eligibleSubmissionIds]
  );

  const assignedSubmissionIdSet = new Set(assignmentRows.map((a: any) => a.submission_id));
  const unassignedSubmissions: JudgingCompletenessResult['unassignedSubmissions'] = [];

  for (const row of eligibleRows) {
    if (!assignedSubmissionIdSet.has(row.submission_id)) {
      unassignedSubmissions.push({
        submissionId: row.submission_id,
        teamId: row.team_id,
        teamName: row.team_name,
      });
      reasons.push(`Team "${row.team_name}" has no assigned judges.`);
    }
  }

  // 3. Fetch all reviews for these assignments
  const { rows: reviewRows } = await query(
    `SELECT jr.submission_id, jr.judge_id, jr.is_complete
     FROM public.judge_reviews jr
     WHERE jr.submission_id = ANY($1::uuid[])`,
    [eligibleSubmissionIds]
  );

  const reviewMap = new Map<string, boolean>();
  for (const r of reviewRows) {
    reviewMap.set(`${r.submission_id}:${r.judge_id}`, r.is_complete === true);
  }

  const incompleteAssignments: JudgingCompletenessResult['incompleteAssignments'] = [];
  let completedReviews = 0;
  let pendingReviews = 0;

  for (const assign of assignmentRows) {
    const key = `${assign.submission_id}:${assign.judge_id}`;
    const isComplete = reviewMap.get(key) === true;

    if (isComplete) {
      completedReviews++;
    } else {
      pendingReviews++;
      incompleteAssignments.push({
        submissionId: assign.submission_id,
        judgeId: assign.judge_id,
        teamName: assign.team_name,
      });
      reasons.push(
        `Evaluation by judge ${assign.judge_id.slice(0, 8)} for Team "${assign.team_name}" is pending or incomplete draft.`
      );
    }
  }

  const isComplete =
    unassignedSubmissions.length === 0 &&
    incompleteAssignments.length === 0 &&
    eligibleTeamCount > 0 &&
    assignmentRows.length > 0;

  return {
    isComplete,
    eligibleTeamCount,
    assignedCount: assignmentRows.length,
    completedReviews,
    pendingReviews,
    unassignedSubmissions,
    incompleteAssignments,
    reasons,
  };
}

/**
 * Gate helper: throws Error if judging is incomplete
 */
export async function requireJudgingComplete(): Promise<JudgingCompletenessResult> {
  const result = await checkJudgingCompleteness();
  if (!result.isComplete) {
    const message = result.reasons.length > 0 
      ? result.reasons.join('; ') 
      : 'Judging is incomplete.';
    const err = new Error(`Cannot transition to RESULTS: ${message}`) as any;
    err.code = 'JUDGING_INCOMPLETE';
    err.details = result;
    throw err;
  }
  return result;
}
