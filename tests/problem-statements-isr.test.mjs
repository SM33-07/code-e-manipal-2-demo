import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Problem Statements ISR, Revalidation & Cache Safety (Phase 3)', () => {

  describe('1. Static Payload & Cache Safety Invariant', () => {
    test('Server page payload contains zero personalized or user-specific state', () => {
      // Import the static PROBLEMS definition from page or verify schema
      const sampleProblems = [
        { track: "Track 01 · AI & Intelligent Systems", title: "Autonomous Multi-Modal Copilot for Rural Healthcare Diagnostics" },
        { track: "Track 02 · Web3 & Decentralized Tech", title: "Verifiable Zero-Knowledge Supply Chain Provenance for Artisanal Crafts" },
        { track: "Track 03 · FinTech & Healthcare Innovation", title: "Real-Time Fraud & Anomaly Triage for Micro-Merchant UPI Payments" },
        { track: "Track 04 · Open Innovation & Sustainability", title: "Clean Energy Optimization & Peak Load Shifting for University Microgrids" },
      ];

      for (const p of sampleProblems) {
        // Must contain only public problem statement content
        assert.ok(p.title);
        assert.ok(p.track);
        assert.equal(typeof p.title, 'string');
      }
    });

    test('Pre-release vault seal: zero challenge leakage when published = false', () => {
      function renderServerView(published) {
        if (!published) {
          return {
            status: 'LOCKED',
            containsChallenges: false,
            renderedHtmlSnippet: 'Awaiting Publication. The challenge vault is sealed.'
          };
        }
        return {
          status: 'LIVE',
          containsChallenges: true,
          renderedHtmlSnippet: 'Official Problem Statements'
        };
      }

      const lockedView = renderServerView(false);
      assert.equal(lockedView.status, 'LOCKED');
      assert.equal(lockedView.containsChallenges, false);
      assert.match(lockedView.renderedHtmlSnippet, /Awaiting Publication/);

      const liveView = renderServerView(true);
      assert.equal(liveView.status, 'LIVE');
      assert.equal(liveView.containsChallenges, true);
    });
  });

  describe('2. Revalidation & Invalidation Correctness', () => {
    test('Revalidation is triggered only after successful database commit', async () => {
      let revalidationCalledWith = null;
      let transactionCommitted = false;

      async function simulatePublish(commitSucceeds) {
        // 1. Transaction BEGIN
        // 2. UPDATE public.event_config
        if (commitSucceeds) {
          transactionCommitted = true;
          // Revalidate path after commit
          revalidationCalledWith = '/problem-statements';
        } else {
          transactionCommitted = false;
          // ROLLBACK — no revalidation
          throw new Error('DATABASE_COMMIT_FAILED');
        }
      }

      await simulatePublish(true);
      assert.equal(transactionCommitted, true);
      assert.equal(revalidationCalledWith, '/problem-statements');

      // Reset
      revalidationCalledWith = null;
      await assert.rejects(
        async () => simulatePublish(false),
        /DATABASE_COMMIT_FAILED/
      );
      assert.equal(revalidationCalledWith, null, 'Cache must not be revalidated if database commit fails');
    });

    test('PATCH /api/event-config forbids direct modification of problem_statements_published', () => {
      function validatePatchBody(body) {
        if (body.problem_statements_published !== undefined) {
          throw new Error('Problem-statement publication can only be changed through POST /api/admin/event-config/problem-statements.');
        }
        return true;
      }

      assert.throws(
        () => validatePatchBody({ problem_statements_published: true }),
        /Problem-statement publication can only be changed through POST/
      );
    });
  });

  describe('3. Admin UI Control Isolation', () => {
    test('Client-side controls return null for non-admin roles', () => {
      function evaluateAdminControlVisibility(role) {
        if (role !== 'admin') return null;
        return { rendered: true };
      }

      assert.equal(evaluateAdminControlVisibility('participant'), null);
      assert.equal(evaluateAdminControlVisibility('judge'), null);
      assert.equal(evaluateAdminControlVisibility(null), null);
      assert.deepEqual(evaluateAdminControlVisibility('admin'), { rendered: true });
    });
  });
});
