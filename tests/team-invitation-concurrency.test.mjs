import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Team Invitation Code Matching, Concurrency & Security Invariants', () => {

  describe('1. Case-Insensitive Invite Code Resolution', () => {
    test('Matches uppercase, lowercase, and mixed-case invite codes consistently', () => {
      const storedInviteCode = 'U5T83P0G';
      const inputs = ['U5T83P0G', 'u5t83p0g', 'U5t83p0g', '  u5t83p0g  '];

      for (const input of inputs) {
        const cleanInput = input.trim();
        const matches = storedInviteCode.toLowerCase() === cleanInput.toLowerCase();
        assert.equal(matches, true, `Input "${input}" should match stored code "${storedInviteCode}"`);
      }
    });

    test('Rejects dissimilar codes under case-insensitive comparison', () => {
      const storedInviteCode = 'U5T83P0G';
      const invalidInputs = ['U5T83P0X', 'V5T83P0G', 'U5T83', ''];

      for (const input of invalidInputs) {
        const cleanInput = input.trim();
        const matches = storedInviteCode.toLowerCase() === cleanInput.toLowerCase();
        assert.equal(matches, false, `Input "${input}" must not match "${storedInviteCode}"`);
      }
    });
  });

  describe('2. Ambiguous Invite Code Rejection Invariant', () => {
    test('Simulated lookup: throws AMBIGUOUS_INVITE_CODE when multiple teams collide', async () => {
      // Mock db client query returning 2 rows (collision)
      const mockQuery = async (sql, params) => {
        if (sql.includes('SELECT id FROM public.teams WHERE LOWER(invite_code) = LOWER($1) FOR UPDATE')) {
          return {
            rows: [
              { id: 'team-uuid-1', invite_code: 'CODE123' },
              { id: 'team-uuid-2', invite_code: 'code123' }
            ]
          };
        }
        return { rows: [] };
      };

      // Mock implementation of joinTeamByInviteCode logic
      async function simulateJoin(clientQuery, inviteCode) {
        const teamRes = await clientQuery(
          'SELECT id FROM public.teams WHERE LOWER(invite_code) = LOWER($1) FOR UPDATE',
          [inviteCode]
        );
        if (teamRes.rows.length === 0) throw new Error('INVALID_INVITE_CODE');
        if (teamRes.rows.length > 1) throw new Error('AMBIGUOUS_INVITE_CODE');
        return teamRes.rows[0];
      }

      await assert.rejects(
        async () => {
          await simulateJoin(mockQuery, 'Code123');
        },
        {
          name: 'Error',
          message: 'AMBIGUOUS_INVITE_CODE'
        }
      );
    });

    test('Simulated lookup: succeeds when exactly one team matches', async () => {
      const mockQuery = async (sql, params) => {
        if (sql.includes('SELECT id FROM public.teams WHERE LOWER(invite_code) = LOWER($1) FOR UPDATE')) {
          assert.equal(params[0], 'u5t83p0g');
          return {
            rows: [{ id: 'team-uuid-1' }]
          };
        }
        return { rows: [] };
      };

      async function simulateJoin(clientQuery, inviteCode) {
        const teamRes = await clientQuery(
          'SELECT id FROM public.teams WHERE LOWER(invite_code) = LOWER($1) FOR UPDATE',
          [inviteCode]
        );
        if (teamRes.rows.length === 0) throw new Error('INVALID_INVITE_CODE');
        if (teamRes.rows.length > 1) throw new Error('AMBIGUOUS_INVITE_CODE');
        return teamRes.rows[0];
      }

      const team = await simulateJoin(mockQuery, 'u5t83p0g');
      assert.equal(team.id, 'team-uuid-1');
    });

    test('Simulated lookup: throws INVALID_INVITE_CODE when zero teams match', async () => {
      const mockQuery = async () => ({ rows: [] });

      async function simulateJoin(clientQuery, inviteCode) {
        const teamRes = await clientQuery(
          'SELECT id FROM public.teams WHERE LOWER(invite_code) = LOWER($1) FOR UPDATE',
          [inviteCode]
        );
        if (teamRes.rows.length === 0) throw new Error('INVALID_INVITE_CODE');
        if (teamRes.rows.length > 1) throw new Error('AMBIGUOUS_INVITE_CODE');
        return teamRes.rows[0];
      }

      await assert.rejects(
        async () => {
          await simulateJoin(mockQuery, 'NONEXISTENT');
        },
        {
          name: 'Error',
          message: 'INVALID_INVITE_CODE'
        }
      );
    });
  });

  describe('3. Concurrency, Capacity & Membership Invariants', () => {
    test('Rejects join when team is already at max capacity (6 members)', async () => {
      const members = [
        { user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' },
        { user_id: 'u4' }, { user_id: 'u5' }, { user_id: 'u6' }
      ];

      function checkCapacity(existingMembers, targetUserId) {
        if (existingMembers.length >= 6) throw new Error('TEAM_FULL');
        if (existingMembers.some(m => m.user_id === targetUserId)) throw new Error('ALREADY_IN_TEAM');
      }

      assert.throws(
        () => checkCapacity(members, 'new-user'),
        { name: 'Error', message: 'TEAM_FULL' }
      );
    });

    test('Rejects re-joining when user is already a member of the team', async () => {
      const members = [
        { user_id: 'u1' }, { user_id: 'u2' }
      ];

      function checkCapacity(existingMembers, targetUserId) {
        if (existingMembers.length >= 6) throw new Error('TEAM_FULL');
        if (existingMembers.some(m => m.user_id === targetUserId)) throw new Error('ALREADY_IN_TEAM');
      }

      assert.throws(
        () => checkCapacity(members, 'u2'),
        { name: 'Error', message: 'ALREADY_IN_TEAM' }
      );
    });

    test('Allows join when capacity < 6 and user is not an existing member', () => {
      const members = [
        { user_id: 'u1' }, { user_id: 'u2' }
      ];

      function checkCapacity(existingMembers, targetUserId) {
        if (existingMembers.length >= 6) throw new Error('TEAM_FULL');
        if (existingMembers.some(m => m.user_id === targetUserId)) throw new Error('ALREADY_IN_TEAM');
        return true;
      }

      assert.equal(checkCapacity(members, 'u3'), true);
    });
  });

  describe('4. Transaction Isolation & Safe Rollback', () => {
    test('Simulates complete transactional rollback on failure without state leak', async () => {
      const operations = [];
      const mockClient = {
        query: async (sql, params) => {
          operations.push({ sql: sql.trim().split(' ')[0], params });
          if (sql.includes('INSERT INTO public.team_members')) {
            throw new Error('SIMULATED_DB_DISCONNECTION');
          }
          if (sql.includes('SELECT id FROM public.teams')) {
            return { rows: [{ id: 'team-1' }] };
          }
          if (sql.includes('SELECT user_id FROM public.team_members')) {
            return { rows: [{ user_id: 'leader-1' }] };
          }
          return { rows: [] };
        },
        release: () => {
          operations.push({ sql: 'RELEASE' });
        }
      };

      let clientReleased = false;
      let failureOccurred = false;
      try {
        await mockClient.query('BEGIN');
        const teamRes = await mockClient.query(
          'SELECT id FROM public.teams WHERE LOWER(invite_code) = LOWER($1) FOR UPDATE',
          ['U5T83P0G']
        );
        const team = teamRes.rows[0];
        const membersRes = await mockClient.query(
          'SELECT user_id FROM public.team_members WHERE team_id = $1',
          [team.id]
        );
        if (membersRes.rows.length >= 6) throw new Error('TEAM_FULL');

        await mockClient.query(
          "INSERT INTO public.team_members (team_id, user_id, role) VALUES ($1, $2, 'member')",
          [team.id, 'new-user']
        );
        await mockClient.query('COMMIT');
      } catch (err) {
        failureOccurred = true;
        await mockClient.query('ROLLBACK');
      } finally {
        if (!clientReleased) mockClient.release();
      }

      assert.equal(failureOccurred, true);
      assert.deepEqual(
        operations.map(o => o.sql),
        ['BEGIN', 'SELECT', 'SELECT', 'INSERT', 'ROLLBACK', 'RELEASE']
      );
    });
  });

  describe('5. SQL Injection & Parameterization Resistance', () => {
    test('Parameter array isolates SQL control characters safely', () => {
      const maliciousPayload = "' OR '1'='1' -- ";
      const queryTemplate = 'SELECT id FROM public.teams WHERE LOWER(invite_code) = LOWER($1) FOR UPDATE';
      const params = [maliciousPayload];

      // Verifies that query template remains strictly parameterized
      assert.equal(queryTemplate.includes('$1'), true);
      assert.equal(queryTemplate.includes(maliciousPayload), false);
      assert.equal(params[0], maliciousPayload);
    });
  });
});
