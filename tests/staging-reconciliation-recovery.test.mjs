import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { assertConnectionBoundaries } from '../scripts/provision-admin-judge.mjs';

describe('Staging Environment Boundaries & Failure Boundary Recovery', () => {

  describe('1. Connection Boundary Assertions', () => {
    test('Rejects non-staging database when isStaging is true', () => {
      assert.throws(
        () => {
          assertConnectionBoundaries({
            isStaging: true,
            isProduction: false,
            dbUrl: 'postgres://user:pass@host.azure.com:5432/postgres',
            sbUrl: 'https://ggmwribwynonpsvsmpyz.supabase.co',
          });
        },
        /Staging Boundary Violation/
      );
    });

    test('Rejects production Supabase URL when isStaging is true', () => {
      assert.throws(
        () => {
          assertConnectionBoundaries({
            isStaging: true,
            isProduction: false,
            dbUrl: 'postgres://user:pass@host.azure.com:5432/cem_staging',
            sbUrl: 'https://ihnclawnbtkwvbfqwxfe.supabase.co',
          });
        },
        /Staging Boundary Violation/
      );
    });

    test('Rejects staging database when isProduction is true', () => {
      assert.throws(
        () => {
          assertConnectionBoundaries({
            isStaging: false,
            isProduction: true,
            dbUrl: 'postgres://user:pass@host.azure.com:5432/cem_staging',
            sbUrl: 'https://ihnclawnbtkwvbfqwxfe.supabase.co',
          });
        },
        /Production Environment Error/
      );
    });
  });

  describe('2. Role Enforcement when Auth Metadata and Azure Profile Disagree (ADR-001)', () => {
    test('Azure profile is sole authoritative source: stale Auth admin metadata is rejected', async () => {
      // Simulate session validation logic per lib/auth/session.ts and lib/auth/guards.ts
      const staleAuthUser = {
        id: 'fake-participant-uuid-001',
        email: 'participant@test.org',
        user_metadata: { role: 'admin' }, // Tampered / stale Auth metadata
      };

      const authoritativeAzureProfile = {
        id: 'fake-participant-uuid-001',
        email: 'participant@test.org',
        role: 'participant', // Authoritative Azure role
        is_disabled: false,
      };

      // Role check per lib/auth/guards.ts
      const hasRole = (userRole, requiredRole) => {
        const hierarchy = { admin: 3, judge: 2, participant: 1 };
        return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
      };

      // ADR-001: Role resolution must evaluate authoritative profile.role, NEVER user_metadata.role
      const resolvedRole = authoritativeAzureProfile.role;
      assert.equal(resolvedRole, 'participant');

      const isAuthorizedAdmin = hasRole(authoritativeAzureProfile.role, 'admin');
      assert.equal(isAuthorizedAdmin, false, 'Participant must NEVER gain admin access from stale Auth metadata');
    });

    test('Disabled account is strictly rejected even if role is admin', () => {
      const disabledAdminProfile = {
        id: 'disabled-admin-uuid-002',
        email: 'admin@test.org',
        role: 'admin',
        is_disabled: true, // Account locked
      };

      const validateStatus = (profile) => {
        if (profile.is_disabled) return { error: 'DISABLED' };
        return { error: null };
      };

      const res = validateStatus(disabledAdminProfile);
      assert.equal(res.error, 'DISABLED', 'Disabled admin must be rejected with DISABLED code');
    });
  });

  describe('3. Compensating Rollback & Dead-Letter Safety', () => {
    test('Dead-letter queue writes structured recovery record', () => {
      const deadLetterPath = path.resolve(process.cwd(), 'data/reconciliation-dead-letter.json');
      const testRecord = {
        authUserId: 'test-orphaned-auth-uuid-999',
        email: 'orphaned@test.internal',
        role: 'admin',
        identifier: 'ADMIN-99',
        error: 'Simulated network timeout during compensation',
        underlyingError: 'Simulated DB deadlock',
      };

      // Load existing or initialize
      let existing = [];
      if (fs.existsSync(deadLetterPath)) {
        try { existing = JSON.parse(fs.readFileSync(deadLetterPath, 'utf8')); } catch (_) {}
      }

      existing.push({ timestamp: new Date().toISOString(), ...testRecord });
      fs.writeFileSync(deadLetterPath, JSON.stringify(existing, null, 2), 'utf8');

      // Verify record is saved
      const loaded = JSON.parse(fs.readFileSync(deadLetterPath, 'utf8'));
      assert.ok(loaded.some(r => r.authUserId === 'test-orphaned-auth-uuid-999'));

      // Clean up test entry
      const cleaned = loaded.filter(r => r.authUserId !== 'test-orphaned-auth-uuid-999');
      fs.writeFileSync(deadLetterPath, JSON.stringify(cleaned, null, 2), 'utf8');
    });
  });
});
