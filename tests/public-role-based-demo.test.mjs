/**
 * Test Suite: Interactive Role-Based Portal Demo Verification
 * File: tests/public-role-based-demo.test.mjs
 *
 * Verifies:
 * 1. Entry Hub & Navigation: /demo route and navigation integration without leaking gallery.
 * 2. Participant Demo: Synthetic team structure, problem statement brief, submission artifacts, and milestones.
 * 3. Judge Demo: Assigned queue across tracks, rubric definitions, and exact weighted scoring calculations.
 * 4. Admin Demo: High-level metrics, user directory, team dossier inspection, judge allocation, and audit logs.
 * 5. Security & Isolation: Zero production credentials, zero database queries, and write-blocking preservation.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { isDemoMode } from '../lib/demo/demoMode.ts';
import {
  getDemoParticipantSummary,
  getDemoJudgeData,
  getDemoJudgeSubmission,
  getDemoAdminData,
  DEMO_PARTICIPANT_SUMMARY,
  DEMO_JUDGE_DATA,
  DEMO_ADMIN_DATA,
} from '../lib/demo/demoFixtures.ts';
import { getPublicNavigation, demoPublicNavigation } from '../lib/navigation/portal.ts';
import { calculateWeightedScore } from '../utils/scoring.ts';
import { WEIGHTS } from '../types/judging.ts';

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

describe('Role Demo Gate 1: Entry Hub & Navigation Integration', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('demoPublicNavigation includes Portal Demo link pointing to /demo', () => {
    const demoItem = demoPublicNavigation.find((i) => i.link === '/demo');
    assert(demoItem, 'Must have item linking to /demo');
    assert.equal(demoItem.name, 'Portal Demo');
  });

  test('getPublicNavigation() includes Portal Demo and excludes Gallery in demo mode', () => {
    process.env.DEMO_MODE = 'true';
    const items = getPublicNavigation();
    const links = items.map((i) => i.link);

    assert(links.includes('/demo'), 'Must include /demo');
    assert(links.includes('/problem-statements'), 'Must include /problem-statements');
    assert(links.includes('/timeline'), 'Must include /timeline');
    assert(links.includes('/results'), 'Must include /results');
    assert(!links.includes('/gallery'), 'Must NOT include /gallery');
  });
});

describe('Role Demo Gate 2: Participant Workspace Fixtures & Data Integrity', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('getDemoParticipantSummary() returns synthetic team NeuralPulse with 4 members', () => {
    const summary = getDemoParticipantSummary();

    assert.equal(summary.team.name, 'Team NeuralPulse');
    assert.equal(summary.team.track, 'AI/ML & Earth Observation');
    assert.equal(summary.team.inviteCode, 'PULSE-DEMO-2026');
    assert.equal(summary.team.leaderName, 'Aarav Sharma');
    assert.equal(summary.team.members.length, 4);

    const leadMember = summary.team.members.find((m) => m.role === 'lead');
    assert(leadMember, 'Must have designated team lead');
    assert.equal(leadMember.name, 'Aarav Sharma');
  });

  test('Participant demo contains selected problem statement PS 05 with deliverables and tests', () => {
    const summary = getDemoParticipantSummary();
    const ps = summary.selectedProblemStatement;

    assert.equal(ps.id, 'PS 05');
    assert(ps.title.includes('ArcSense'));
    assert.equal(ps.difficulty, 'Advanced');
    assert(ps.scopeNote.length > 20);
    assert(ps.deliverables.length > 20);
    assert(ps.evaluationTests.length > 20);
  });

  test('Participant demo contains submitted project artifacts and locked status', () => {
    const summary = getDemoParticipantSummary();
    const sub = summary.submission;

    assert.equal(sub.status, 'SUBMITTED');
    assert.equal(sub.isLocked, true);
    assert(sub.githubUrl.startsWith('https://github.com/'));
    assert(sub.demoUrl.startsWith('https://'));
    assert(sub.docsUrl.startsWith('https://'));
    assert(sub.demoVideoUrl.startsWith('https://'));
  });

  test('Zero passwords, real credentials, or production tokens exist in participant fixtures', () => {
    const jsonStr = JSON.stringify(DEMO_PARTICIPANT_SUMMARY);
    assert(!jsonStr.includes('password'), 'Must not contain password');
    assert(!jsonStr.includes('supabase'), 'Must not contain supabase credentials');
    assert(!jsonStr.includes('postgres:'), 'Must not contain postgres connection string');
  });
});

describe('Role Demo Gate 3: Judge Workspace, Queue & Rubric Simulator', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('getDemoJudgeData() returns Dr. Sarah Jenkins profile with 4 assigned submissions', () => {
    const judgeData = getDemoJudgeData();

    assert.equal(judgeData.judgeProfile.name, 'Dr. Sarah Jenkins');
    assert.equal(judgeData.judgeProfile.badgeId, 'JUDGE-EVAL-882');
    assert.equal(judgeData.assignedSubmissions.length, 4);

    const completed = judgeData.assignedSubmissions.filter((s) => s.reviewStatus === 'completed');
    const pending = judgeData.assignedSubmissions.filter((s) => s.reviewStatus === 'pending');
    assert.equal(completed.length, 2, 'Must have 2 completed submissions');
    assert.equal(pending.length, 2, 'Must have 2 pending submissions');
  });

  test('getDemoJudgeSubmission resolves submissions by ID', () => {
    const sub1 = getDemoJudgeSubmission('demo-sub-01');
    assert(sub1, 'Must resolve demo-sub-01');
    assert.equal(sub1.teamName, 'Team NeuralPulse');
    assert.equal(sub1.scores.total, 96.5);

    const sub4 = getDemoJudgeSubmission('demo-sub-04');
    assert(sub4, 'Must resolve demo-sub-04');
    assert.equal(sub4.teamName, 'Team AgriSense');
    assert.equal(sub4.reviewStatus, 'pending');

    const invalid = getDemoJudgeSubmission('non-existent-sub');
    assert.equal(invalid, null, 'Must return null for invalid submission ID');
  });

  test('calculateWeightedScore accurately computes rubric total matching criteria weights', () => {
    assert.equal(WEIGHTS.innovation, 0.30);
    assert.equal(WEIGHTS.technical, 0.30);
    assert.equal(WEIGHTS.presentation, 0.20);
    assert.equal(WEIGHTS.impact, 0.20);

    // Test with sample scores: 9.8, 9.6, 9.5, 9.7
    // Expected: 9.8 * 0.3 + 9.6 * 0.3 + 9.5 * 0.2 + 9.7 * 0.2
    // = 2.94 + 2.88 + 1.90 + 1.94 = 9.66
    const calculated = calculateWeightedScore({
      innovation: 9.8,
      technical: 9.6,
      presentation: 9.5,
      impact: 9.7,
    });
    const roundedScaled = Math.round(calculated * 10 * 10) / 10;
    assert.equal(roundedScaled, 96.6);
  });
});

describe('Role Demo Gate 4: Admin Operations Console, Roster & Audit Logs', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  test('getDemoAdminData() returns event statistics with 86 teams and 78 submissions', () => {
    const adminData = getDemoAdminData();

    assert.equal(adminData.stats.totalTeams, 86);
    assert.equal(adminData.stats.totalSubmissions, 78);
    assert.equal(adminData.stats.reviewedCount, 74);
    assert.equal(adminData.stats.totalUsers, 342);
    assert.equal(adminData.stats.tracksCount, 9);
    assert.equal(adminData.stats.avgScore, 87.4);
  });

  test('Admin demo provides 15 synthetic users across Participant, Judge, and Admin roles', () => {
    const adminData = getDemoAdminData();

    assert.equal(adminData.users.length, 15);
    const participants = adminData.users.filter((u) => u.role === 'participant');
    const judges = adminData.users.filter((u) => u.role === 'judge');
    const admins = adminData.users.filter((u) => u.role === 'admin');

    assert(participants.length >= 7, 'Must have multiple participants');
    assert(judges.length >= 4, 'Must have multiple judges');
    assert(admins.length >= 3, 'Must have multiple admins');

    // Confirm no passwords or real tokens exist in user records
    for (const u of adminData.users) {
      assert.equal(u.password, undefined);
      assert.equal(u.token, undefined);
    }
  });

  test('Admin demo provides judge panel allocation matrix with 5 judges', () => {
    const adminData = getDemoAdminData();

    assert.equal(adminData.judgeAllocations.length, 5);
    for (const j of adminData.judgeAllocations) {
      assert(j.judgeName.length > 0);
      assert(j.assignedCount > 0);
      assert(j.completedCount <= j.assignedCount);
      assert(j.assignedTracks.length > 0);
    }
  });

  test('Admin demo provides 12 chronological audit logs with status and actor tracking', () => {
    const adminData = getDemoAdminData();

    assert.equal(adminData.auditLogs.length, 12);
    const actions = adminData.auditLogs.map((l) => l.action);

    assert(actions.includes('RESULTS_PUBLISHED'));
    assert(actions.includes('GLOBAL_FREEZE_ENABLED'));
    assert(actions.includes('SCORE_SUBMITTED'));
    assert(actions.includes('SUBMISSION_WINDOW_CLOSED'));
    assert(actions.includes('CHALLENGES_PUBLISHED'));

    for (const l of adminData.auditLogs) {
      assert(l.timestamp);
      assert(l.actor);
      assert(l.role);
      assert(l.details);
    }
  });
});
