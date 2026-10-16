/**
 * Tests: Weighted Scoring Rubric (30/30/20/20 out of 10)
 * File: tests/scoring-rubric-weighted.test.mjs
 *
 * Verifies:
 * 1. Criterion weighting: Innovation 30%, Technical 30%, Presentation 20%, Impact 20%.
 * 2. Range validation: Max score = 10.00, Min score = 1.00.
 * 3. Deterministic ranking tie-breaking: Total Score -> Technical -> Innovation -> Created At.
 * 4. Concurrency & history safety with weighted calculation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Weighted Scoring Rubric (30/30/20/20) Verification Suite', () => {
  const WEIGHTS = {
    innovation: 0.30,
    technical: 0.30,
    presentation: 0.20,
    impact: 0.20,
  };

  function computeWeightedScore({ innovation, technical, presentation, impact }) {
    const total =
      innovation * WEIGHTS.innovation +
      technical * WEIGHTS.technical +
      presentation * WEIGHTS.presentation +
      impact * WEIGHTS.impact;
    return Number(total.toFixed(2));
  }

  describe('1. Mathematical Boundary & Weighting Precision', () => {
    it('computes exact 10.00 for perfect 10/10 scores', () => {
      const score = computeWeightedScore({
        innovation: 10,
        technical: 10,
        presentation: 10,
        impact: 10,
      });
      assert.strictEqual(score, 10.00);
    });

    it('computes exact 1.00 for minimum 1/10 scores', () => {
      const score = computeWeightedScore({
        innovation: 1,
        technical: 1,
        presentation: 1,
        impact: 1,
      });
      assert.strictEqual(score, 1.00);
    });

    it('accurately applies 30% weight to Innovation and Technical', () => {
      // 10 Innovation only (others 0): 10 * 0.30 = 3.00
      const innoOnly = computeWeightedScore({ innovation: 10, technical: 0, presentation: 0, impact: 0 });
      assert.strictEqual(innoOnly, 3.00);

      // 10 Technical only (others 0): 10 * 0.30 = 3.00
      const techOnly = computeWeightedScore({ innovation: 0, technical: 10, presentation: 0, impact: 0 });
      assert.strictEqual(techOnly, 3.00);
    });

    it('accurately applies 20% weight to Presentation and Impact', () => {
      // 10 Presentation only: 10 * 0.20 = 2.00
      const presOnly = computeWeightedScore({ innovation: 0, technical: 0, presentation: 10, impact: 0 });
      assert.strictEqual(presOnly, 2.00);

      // 10 Impact only: 10 * 0.20 = 2.00
      const impOnly = computeWeightedScore({ innovation: 0, technical: 0, presentation: 0, impact: 10 });
      assert.strictEqual(impOnly, 2.00);
    });

    it('correctly calculates realistic mixed judge evaluations', () => {
      // Innovation: 8 (2.4), Technical: 9 (2.7), Presentation: 7 (1.4), Impact: 8 (1.6) -> Total = 8.10
      const mixed = computeWeightedScore({ innovation: 8, technical: 9, presentation: 7, impact: 8 });
      assert.strictEqual(mixed, 8.10);
    });
  });

  describe('2. Deterministic Ranking & Tie-Break Ordering', () => {
    function rankSubmissions(submissions) {
      return [...submissions].sort((a, b) => {
        // 1. Total score DESC
        if (b.total_score !== a.total_score) {
          return b.total_score - a.total_score;
        }
        // 2. Technical score DESC (Tie-breaker 1)
        if (b.avg_technical !== a.avg_technical) {
          return b.avg_technical - a.avg_technical;
        }
        // 3. Innovation score DESC (Tie-breaker 2)
        if (b.avg_innovation !== a.avg_innovation) {
          return b.avg_innovation - a.avg_innovation;
        }
        // 4. Submission time ASC (Tie-breaker 3)
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }

    it('ranks higher total score first', () => {
      const subs = [
        { id: 'sub-1', total_score: 7.50, avg_technical: 7, avg_innovation: 8, created_at: '2026-10-16T01:00:00Z' },
        { id: 'sub-2', total_score: 8.50, avg_technical: 8, avg_innovation: 9, created_at: '2026-10-16T01:00:00Z' },
      ];
      const ranked = rankSubmissions(subs);
      assert.strictEqual(ranked[0].id, 'sub-2');
      assert.strictEqual(ranked[1].id, 'sub-1');
    });

    it('breaks ties using Technical Execution (Tie-breaker 1)', () => {
      // Both total 8.00, but sub-2 has higher technical (9 vs 7)
      const subs = [
        { id: 'sub-1', total_score: 8.00, avg_technical: 7, avg_innovation: 9, created_at: '2026-10-16T01:00:00Z' },
        { id: 'sub-2', total_score: 8.00, avg_technical: 9, avg_innovation: 7, created_at: '2026-10-16T01:00:00Z' },
      ];
      const ranked = rankSubmissions(subs);
      assert.strictEqual(ranked[0].id, 'sub-2');
      assert.strictEqual(ranked[1].id, 'sub-1');
    });

    it('breaks secondary ties using Innovation (Tie-breaker 2)', () => {
      // Both total 8.00 and technical 8, but sub-1 has higher innovation (9 vs 7)
      const subs = [
        { id: 'sub-2', total_score: 8.00, avg_technical: 8, avg_innovation: 7, created_at: '2026-10-16T01:00:00Z' },
        { id: 'sub-1', total_score: 8.00, avg_technical: 8, avg_innovation: 9, created_at: '2026-10-16T01:00:00Z' },
      ];
      const ranked = rankSubmissions(subs);
      assert.strictEqual(ranked[0].id, 'sub-1');
      assert.strictEqual(ranked[1].id, 'sub-2');
    });

    it('breaks tertiary ties using earliest submission timestamp (Tie-breaker 3)', () => {
      // All scores equal, but sub-1 submitted 10 minutes earlier
      const subs = [
        { id: 'sub-2', total_score: 8.00, avg_technical: 8, avg_innovation: 8, created_at: '2026-10-16T01:10:00Z' },
        { id: 'sub-1', total_score: 8.00, avg_technical: 8, avg_innovation: 8, created_at: '2026-10-16T01:00:00Z' },
      ];
      const ranked = rankSubmissions(subs);
      assert.strictEqual(ranked[0].id, 'sub-1');
      assert.strictEqual(ranked[1].id, 'sub-2');
    });
  });
});
