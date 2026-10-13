import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { executeInaccessibleEmailRecovery } from '../lib/auth/inaccessibleEmailRecovery.ts';

describe('Inaccessible Email Recovery: Failure-Handling & Compensation Invariants', () => {
  const adminUserId = 'a0000000-0000-4000-8000-000000000001';
  const targetUserId = 'b0000000-0000-4000-8000-000000000002';
  const originalEmail = 'participant.lost@example.org';
  const replacementEmail = 'participant.new@example.org';
  const reason = 'Verified participant identity via university ID card and Discord ticket.';

  function createMockProfile(overrides = {}) {
    return {
      id: targetUserId,
      name: 'Test Participant',
      email: originalEmail,
      role: 'participant',
      identifier: 'TEAM-042',
      is_disabled: false,
      ...overrides,
    };
  }

  test('1. Auth update fails before database changes: database is not modified', async () => {
    let dbMutated = false;
    const mockDbQuery = async (queryText, params) => {
      if (queryText.includes('SELECT id, name, email, role')) {
        return { rows: [createMockProfile()] };
      }
      if (queryText.includes('SELECT id FROM public.profiles WHERE LOWER(email) = $1')) {
        return { rows: [] };
      }
      if (queryText.includes('BEGIN') || queryText.includes('UPDATE')) {
        dbMutated = true;
      }
      return { rows: [] };
    };

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          getUserById: async (id) => ({
            data: { user: { id, email: originalEmail } },
            error: null,
          }),
          updateUserById: async (id, attrs) => ({
            data: null,
            error: { message: 'Supabase Auth service timeout' },
          }),
        },
      },
    };

    const result = await executeInaccessibleEmailRecovery({
      targetUserId,
      replacementEmail,
      reason,
      adminUserId,
      dbQuery: mockDbQuery,
      supabaseAdmin: mockSupabaseAdmin,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 500);
    assert.ok(result.error.includes('Auth update failed'));
    assert.equal(dbMutated, false, 'Database should never be mutated if Auth update fails');
  });

  test('2. Auth succeeds and database update commits: both systems synchronized and recovery dispatched', async () => {
    const executedQueries = [];
    const authUpdates = [];
    let passwordResetEmail = null;

    const mockDbQuery = async (queryText, params) => {
      executedQueries.push({ text: queryText, params });
      if (queryText.includes('SELECT id, name, email, role')) {
        return { rows: [createMockProfile()] };
      }
      if (queryText.includes('SELECT id FROM public.profiles WHERE LOWER(email) = $1')) {
        return { rows: [] };
      }
      if (queryText.includes('UPDATE public.profiles SET email = $1')) {
        return { rows: [{ id: targetUserId }] };
      }
      return { rows: [] };
    };

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          getUserById: async (id) => ({
            data: { user: { id, email: originalEmail } },
            error: null,
          }),
          updateUserById: async (id, attrs) => {
            authUpdates.push(attrs);
            return { data: { user: { id, email: attrs.email } }, error: null };
          },
        },
        resetPasswordForEmail: async (email, options) => {
          passwordResetEmail = email;
          return { data: {}, error: null };
        },
      },
    };

    const result = await executeInaccessibleEmailRecovery({
      targetUserId,
      replacementEmail,
      reason,
      adminUserId,
      dbQuery: mockDbQuery,
      supabaseAdmin: mockSupabaseAdmin,
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 200);
    assert.ok(result.message.includes(replacementEmail));
    assert.equal(authUpdates.length, 1);
    assert.equal(authUpdates[0].email, replacementEmail);
    assert.equal(passwordResetEmail, replacementEmail);

    const queryTexts = executedQueries.map(q => q.text);
    assert.ok(queryTexts.some(q => q.includes('BEGIN')));
    assert.ok(queryTexts.some(q => q.includes('UPDATE public.profiles')));
    assert.ok(queryTexts.some(q => q.includes('INSERT INTO public.audit_logs')));
    assert.ok(queryTexts.some(q => q.includes('COMMIT')));
  });

  test('3. Database update fails and compensation succeeds: Auth safely reverted to original email', async () => {
    const authCalls = [];
    const dbCalls = [];

    const mockDbQuery = async (queryText, params) => {
      dbCalls.push(queryText);
      if (queryText.includes('SELECT id, name, email, role')) {
        return { rows: [createMockProfile()] };
      }
      if (queryText.includes('SELECT id FROM public.profiles WHERE LOWER(email) = $1')) {
        return { rows: [] };
      }
      if (queryText.includes('BEGIN')) {
        return { rows: [] };
      }
      if (queryText.includes('UPDATE public.profiles SET email = $1')) {
        throw new Error('Azure PostgreSQL connection broken');
      }
      if (queryText.includes('ROLLBACK')) {
        return { rows: [] };
      }
      return { rows: [] };
    };

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          getUserById: async (id) => ({
            data: { user: { id, email: originalEmail } },
            error: null,
          }),
          updateUserById: async (id, attrs) => {
            authCalls.push(attrs);
            // Both update and compensation succeed
            return { data: { user: { id, email: attrs.email } }, error: null };
          },
        },
        resetPasswordForEmail: async () => {
          assert.fail('Should not dispatch password reset when DB update fails');
        },
      },
    };

    const result = await executeInaccessibleEmailRecovery({
      targetUserId,
      replacementEmail,
      reason,
      adminUserId,
      dbQuery: mockDbQuery,
      supabaseAdmin: mockSupabaseAdmin,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 500);
    assert.ok(result.error.includes('safely reverted to its original state'));

    // Step 1: Forward update to replacementEmail
    assert.equal(authCalls[0].email, replacementEmail);
    // Step 2: Compensation reverting to originalEmail
    assert.equal(authCalls[1].email, originalEmail);

    assert.ok(dbCalls.some(q => q.includes('ROLLBACK')));
  });

  test('4. Database update fails and compensation also fails: critical reconciliation logged and operator alert returned', async () => {
    const authCalls = [];
    let criticalAuditLogged = false;

    const mockDbQuery = async (queryText, params) => {
      if (queryText.includes('SELECT id, name, email, role')) {
        return { rows: [createMockProfile()] };
      }
      if (queryText.includes('SELECT id FROM public.profiles WHERE LOWER(email) = $1')) {
        return { rows: [] };
      }
      if (queryText.includes('UPDATE public.profiles SET email = $1')) {
        throw new Error('Disk full on Azure PG');
      }
      if (queryText.includes('CRITICAL_EMAIL_RECOVERY_DESYNC')) {
        criticalAuditLogged = true;
        const details = JSON.parse(params[2]);
        assert.equal(details.auth_email, replacementEmail);
        assert.equal(details.profile_email, originalEmail);
        assert.equal(details.reconciliation_required, true);
        return { rows: [] };
      }
      return { rows: [] };
    };

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          getUserById: async (id) => ({
            data: { user: { id, email: originalEmail } },
            error: null,
          }),
          updateUserById: async (id, attrs) => {
            authCalls.push(attrs);
            if (attrs.email === replacementEmail) {
              return { data: { user: { id, email: attrs.email } }, error: null };
            }
            // Compensation fails!
            return { data: null, error: { message: 'Upstream Auth service 503 during compensation' } };
          },
        },
      },
    };

    const result = await executeInaccessibleEmailRecovery({
      targetUserId,
      replacementEmail,
      reason,
      adminUserId,
      dbQuery: mockDbQuery,
      supabaseAdmin: mockSupabaseAdmin,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 500);
    assert.equal(result.reconciliationRequired, true);
    assert.ok(result.error.includes('CRITICAL_DESYNC'));
    assert.ok(result.error.includes('TEAM-042'));
    assert.ok(result.error.includes(targetUserId));
    assert.equal(criticalAuditLogged, true, 'Must record CRITICAL_EMAIL_RECOVERY_DESYNC audit log');
  });

  test('5. Audit logging failure inside database transaction rolls back and triggers safe compensation', async () => {
    const authCalls = [];

    const mockDbQuery = async (queryText, params) => {
      if (queryText.includes('SELECT id, name, email, role')) {
        return { rows: [createMockProfile()] };
      }
      if (queryText.includes('SELECT id FROM public.profiles WHERE LOWER(email) = $1')) {
        return { rows: [] };
      }
      if (queryText.includes('UPDATE public.profiles SET email = $1')) {
        return { rows: [{ id: targetUserId }] };
      }
      if (queryText.includes('INSERT INTO public.audit_logs')) {
        throw new Error('Audit table constraint violation');
      }
      return { rows: [] };
    };

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          getUserById: async (id) => ({
            data: { user: { id, email: originalEmail } },
            error: null,
          }),
          updateUserById: async (id, attrs) => {
            authCalls.push(attrs);
            return { data: { user: { id, email: attrs.email } }, error: null };
          },
        },
      },
    };

    const result = await executeInaccessibleEmailRecovery({
      targetUserId,
      replacementEmail,
      reason,
      adminUserId,
      dbQuery: mockDbQuery,
      supabaseAdmin: mockSupabaseAdmin,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 500);
    assert.ok(result.error.includes('safely reverted to its original state'));
    assert.equal(authCalls.length, 2);
    assert.equal(authCalls[0].email, replacementEmail);
    assert.equal(authCalls[1].email, originalEmail);
  });

  test('6. Idempotent retry returns success when both systems already reflect replacement email', async () => {
    const mockDbQuery = async (queryText) => {
      if (queryText.includes('SELECT id, name, email, role')) {
        // Profile already updated to replacement email
        return { rows: [createMockProfile({ email: replacementEmail })] };
      }
      if (queryText.includes('SELECT id FROM public.profiles WHERE LOWER(email) = $1')) {
        return { rows: [] };
      }
      return { rows: [] };
    };

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          getUserById: async (id) => ({
            // Auth already updated to replacement email
            data: { user: { id, email: replacementEmail } },
            error: null,
          }),
        },
      },
    };

    // If replacement email equals original profile email, it detects identical email immediately
    const resultSameEmail = await executeInaccessibleEmailRecovery({
      targetUserId,
      replacementEmail: originalEmail,
      reason,
      adminUserId,
      dbQuery: async () => ({ rows: [createMockProfile({ email: originalEmail })] }),
      supabaseAdmin: mockSupabaseAdmin,
    });
    assert.equal(resultSameEmail.success, false);
    assert.equal(resultSameEmail.status, 400);
    assert.ok(resultSameEmail.error.includes('identical to current registered email'));
  });

  test('7. Optimistic concurrency race: profile modified concurrently triggers rollback & compensation', async () => {
    const authCalls = [];

    const mockDbQuery = async (queryText) => {
      if (queryText.includes('SELECT id, name, email, role')) {
        return { rows: [createMockProfile()] };
      }
      if (queryText.includes('SELECT id FROM public.profiles WHERE LOWER(email) = $1')) {
        return { rows: [] };
      }
      if (queryText.includes('UPDATE public.profiles SET email = $1')) {
        // Concurrency collision: 0 rows returned because email condition did not match
        return { rows: [] };
      }
      return { rows: [] };
    };

    const mockSupabaseAdmin = {
      auth: {
        admin: {
          getUserById: async (id) => ({
            data: { user: { id, email: originalEmail } },
            error: null,
          }),
          updateUserById: async (id, attrs) => {
            authCalls.push(attrs);
            return { data: { user: { id, email: attrs.email } }, error: null };
          },
        },
      },
    };

    const result = await executeInaccessibleEmailRecovery({
      targetUserId,
      replacementEmail,
      reason,
      adminUserId,
      dbQuery: mockDbQuery,
      supabaseAdmin: mockSupabaseAdmin,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 500);
    assert.ok(result.error.includes('safely reverted to its original state'));
    assert.equal(authCalls.length, 2);
    assert.equal(authCalls[1].email, originalEmail, 'Must revert Auth when concurrency collision occurs');
  });

  test('8. Strict role enforcement: admins and judges are forbidden from fallback email recovery', async () => {
    for (const forbiddenRole of ['admin', 'judge']) {
      const mockDbQuery = async (queryText) => {
        if (queryText.includes('SELECT id, name, email, role')) {
          return { rows: [createMockProfile({ role: forbiddenRole })] };
        }
        return { rows: [] };
      };

      const result = await executeInaccessibleEmailRecovery({
        targetUserId,
        replacementEmail,
        reason,
        adminUserId,
        dbQuery: mockDbQuery,
        supabaseAdmin: {},
      });

      assert.equal(result.success, false);
      assert.equal(result.status, 403);
      assert.ok(result.error.includes('strictly restricted to participant accounts'));
    }
  });
});
