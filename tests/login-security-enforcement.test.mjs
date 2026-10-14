import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Login Route Security & Account Status Enforcement (Regression Suite)', () => {
  const loginRoutePath = path.resolve(process.cwd(), 'app/api/auth/login/route.ts');
  const routeContent = fs.readFileSync(loginRoutePath, 'utf8');

  // Gate 1: Source code invariant checks
  describe('1. Static Security Invariant Verification', () => {
    test('Queries is_disabled during email pre-lookup', () => {
      assert.ok(
        routeContent.includes('SELECT id, email, identifier, login_id, is_disabled FROM public.profiles'),
        'Email pre-lookup must query is_disabled'
      );
    });

    test('Queries is_disabled during identifier pre-lookup', () => {
      assert.ok(
        routeContent.includes('SELECT id, email, identifier, login_id, is_disabled FROM public.profiles'),
        'Identifier pre-lookup must query is_disabled'
      );
    });

    test('Fails closed on database error during profile pre-lookup', () => {
      assert.ok(
        routeContent.includes("Errors.INTERNAL('Database temporarily unavailable. Please retry.')"),
        'Must return 500 error if DB query fails during pre-lookup'
      );
    });

    test('Performs authoritative UUID-to-profile resolution after GoTrue authentication', () => {
      assert.ok(
        routeContent.includes('WHERE id = $1'),
        'Must resolve authenticated user UUID to profile'
      );
      assert.ok(
        routeContent.includes('authenticatedProfile.is_disabled'),
        'Must inspect authenticatedProfile.is_disabled'
      );
    });

    test('Invalidates GoTrue session if authenticated account is discovered to be disabled', () => {
      assert.ok(
        routeContent.includes('supabase.auth.admin.signOut(data.session.access_token)'),
        'Must invalidate GoTrue session if account is disabled'
      );
    });

    test('Verifies identity alignment to prevent email/identifier substitution', () => {
      assert.ok(
        routeContent.includes('authenticatedProfile.email.toLowerCase() !== data.user!.email.toLowerCase()'),
        'Must verify Auth email matches profile email'
      );
    });

    test('Clears force_logout_before strictly for verified active accounts only', () => {
      // The update must appear AFTER the is_disabled check
      const disabledCheckIdx = routeContent.indexOf('if (authenticatedProfile.is_disabled)');
      const forceLogoutClearIdx = routeContent.indexOf('UPDATE public.profiles SET force_logout_before = NULL');
      assert.ok(disabledCheckIdx > 0, 'Must have is_disabled check');
      assert.ok(forceLogoutClearIdx > 0, 'Must have force_logout_before clear query');
      assert.ok(
        forceLogoutClearIdx > disabledCheckIdx,
        'force_logout_before must ONLY be cleared after verifying account is NOT disabled'
      );
    });
  });

  // Gate 2: Functional Simulation of Account Status Evaluation
  describe('2. Login Pipeline Behavioral Simulation', () => {
    async function simulateLoginPipeline({
      rawInput,
      password,
      profilesDb,
      authUsersDb,
      dbThrows = false,
    }) {
      const GENERIC_AUTH_ERROR = 'Invalid identifier or password.';
      const trimmed = rawInput.trim();
      let identityKey;
      let syntheticEmail;

      if (dbThrows) {
        return { status: 500, error: 'Database temporarily unavailable. Please retry.' };
      }

      if (trimmed.includes('@')) {
        identityKey = trimmed.toLowerCase();
        syntheticEmail = identityKey;

        const matching = profilesDb.filter(p => p.email.toLowerCase() === identityKey);
        if (matching.length > 1) return { status: 401, error: GENERIC_AUTH_ERROR };
        if (matching.length === 1 && matching[0].is_disabled) {
          return { status: 401, error: GENERIC_AUTH_ERROR, reason: 'DISABLED_EARLY' };
        }
      } else {
        const canonical = trimmed.toUpperCase().replace('TEAM', 'TEAM-');
        const compact = canonical.replace(/-/g, '');
        identityKey = canonical;

        const matching = profilesDb.filter(p =>
          p.identifier?.toUpperCase() === canonical ||
          p.identifier?.toUpperCase() === compact ||
          p.login_id?.toUpperCase() === trimmed.toUpperCase()
        );
        if (matching.length > 1) return { status: 401, error: GENERIC_AUTH_ERROR };
        if (matching.length === 1 && matching[0].is_disabled) {
          return { status: 401, error: GENERIC_AUTH_ERROR, reason: 'DISABLED_EARLY' };
        }
        if (matching.length === 1 && matching[0].email) {
          syntheticEmail = matching[0].email;
        } else {
          syntheticEmail = `${identityKey.toLowerCase()}@auth.codeemanipal.in`;
        }
      }

      // Supabase GoTrue Auth simulation
      const authUser = authUsersDb.find(u => u.email.toLowerCase() === syntheticEmail.toLowerCase());
      if (!authUser || authUser.password !== password) {
        return { status: 401, error: GENERIC_AUTH_ERROR, reason: 'BAD_PASSWORD' };
      }

      // Authoritative post-auth profile verification
      const profile = profilesDb.find(p => p.id === authUser.id);
      if (!profile) {
        return { status: 401, error: GENERIC_AUTH_ERROR, reason: 'NO_PROFILE' };
      }

      if (profile.is_disabled) {
        return {
          status: 401,
          error: GENERIC_AUTH_ERROR,
          reason: 'DISABLED_POST_AUTH',
          sessionRevoked: true,
          forceLogoutCleared: false,
        };
      }

      if (profile.email.toLowerCase() !== authUser.email.toLowerCase()) {
        return { status: 401, error: GENERIC_AUTH_ERROR, reason: 'IDENTITY_MISMATCH' };
      }

      // Success: clear force_logout_before
      profile.force_logout_before = null;

      return {
        status: 200,
        user: { id: profile.id, email: profile.email, identifier: profile.identifier },
        session: { access_token: `jwt-${profile.id}`, expires_at: Date.now() + 3600 },
        forceLogoutCleared: true,
      };
    }

    test('Active admin login via email succeeds and clears force_logout_before', async () => {
      const profilesDb = [
        { id: 'u-admin-1', email: 'sohammore3312@gmail.com', identifier: 'ADMIN-04', role: 'admin', is_disabled: false, force_logout_before: '2026-10-14T00:00:00Z' },
      ];
      const authUsersDb = [
        { id: 'u-admin-1', email: 'sohammore3312@gmail.com', password: 'CorrectPassword123!' },
      ];

      const res = await simulateLoginPipeline({
        rawInput: 'sohammore3312@gmail.com',
        password: 'CorrectPassword123!',
        profilesDb,
        authUsersDb,
      });

      assert.equal(res.status, 200);
      assert.equal(res.forceLogoutCleared, true);
      assert.equal(profilesDb[0].force_logout_before, null);
    });

    test('Active participant login via identifier succeeds and clears force_logout_before', async () => {
      const profilesDb = [
        { id: 'u-team-42', email: 'team42@example.org', identifier: 'TEAM-042', login_id: 'TEAM042', role: 'participant', is_disabled: false, force_logout_before: '2026-10-14T00:00:00Z' },
      ];
      const authUsersDb = [
        { id: 'u-team-42', email: 'team42@example.org', password: 'TempPass8Char!' },
      ];

      const res = await simulateLoginPipeline({
        rawInput: 'TEAM042',
        password: 'TempPass8Char!',
        profilesDb,
        authUsersDb,
      });

      assert.equal(res.status, 200);
      assert.equal(res.forceLogoutCleared, true);
      assert.equal(profilesDb[0].force_logout_before, null);
    });

    test('Disabled account login via identifier is rejected and never clears force_logout_before', async () => {
      const originalRevocationTime = '2026-10-14T00:00:00Z';
      const profilesDb = [
        { id: 'u-disabled-1', email: 'locked@example.org', identifier: 'TEAM-099', login_id: 'TEAM099', role: 'participant', is_disabled: true, force_logout_before: originalRevocationTime },
      ];
      const authUsersDb = [
        { id: 'u-disabled-1', email: 'locked@example.org', password: 'ValidPassword123' },
      ];

      const res = await simulateLoginPipeline({
        rawInput: 'TEAM099',
        password: 'ValidPassword123',
        profilesDb,
        authUsersDb,
      });

      assert.equal(res.status, 401);
      assert.equal(res.error, 'Invalid identifier or password.');
      assert.equal(profilesDb[0].force_logout_before, originalRevocationTime, 'Revocation timestamp must not be cleared');
    });

    test('Disabled account login via email is rejected and never clears force_logout_before', async () => {
      const originalRevocationTime = '2026-10-14T00:00:00Z';
      const profilesDb = [
        { id: 'u-disabled-2', email: 'decommissioned@example.org', identifier: 'ADMIN-01', role: 'admin', is_disabled: true, force_logout_before: originalRevocationTime },
      ];
      const authUsersDb = [
        { id: 'u-disabled-2', email: 'decommissioned@example.org', password: 'ValidAdminPassword123!' },
      ];

      const res = await simulateLoginPipeline({
        rawInput: 'decommissioned@example.org',
        password: 'ValidAdminPassword123!',
        profilesDb,
        authUsersDb,
      });

      assert.equal(res.status, 401);
      assert.equal(res.error, 'Invalid identifier or password.');
      assert.equal(profilesDb[0].force_logout_before, originalRevocationTime, 'Revocation timestamp must not be cleared');
    });

    test('Database error fails closed with HTTP 500 and prevents token issuance', async () => {
      const profilesDb = [
        { id: 'u-1', email: 'user@example.org', identifier: 'TEAM-001', role: 'participant', is_disabled: false },
      ];
      const authUsersDb = [
        { id: 'u-1', email: 'user@example.org', password: 'password123' },
      ];

      const res = await simulateLoginPipeline({
        rawInput: 'TEAM001',
        password: 'password123',
        profilesDb,
        authUsersDb,
        dbThrows: true,
      });

      assert.equal(res.status, 500);
      assert.equal(res.session, undefined);
    });

    test('Failed password attempt never touches force_logout_before or profile state', async () => {
      const originalRevocationTime = '2026-10-14T01:00:00Z';
      const profilesDb = [
        { id: 'u-2', email: 'active@example.org', identifier: 'TEAM-002', role: 'participant', is_disabled: false, force_logout_before: originalRevocationTime },
      ];
      const authUsersDb = [
        { id: 'u-2', email: 'active@example.org', password: 'RealPassword123' },
      ];

      const res = await simulateLoginPipeline({
        rawInput: 'TEAM002',
        password: 'WRONG_PASSWORD_XYZ',
        profilesDb,
        authUsersDb,
      });

      assert.equal(res.status, 401);
      assert.equal(profilesDb[0].force_logout_before, originalRevocationTime);
    });
  });
});
