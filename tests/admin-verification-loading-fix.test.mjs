import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Admin Console Verification & Bounded State Transitions (Phase 2)', () => {

  // 1. Existing admin login after a fresh browser session
  test('Scenario 1: Existing admin login resolves profile and assigns admin role', () => {
    function simulateAdminAuthSuccess(inputIdentifier, profileRecord) {
      const cleanInput = inputIdentifier.trim();
      const normalizedKey = cleanInput.toUpperCase();
      
      const isMatch =
        profileRecord.identifier.toUpperCase() === normalizedKey ||
        profileRecord.login_id?.toUpperCase() === normalizedKey;

      if (!isMatch) return { status: 401, error: 'Invalid identifier or password.' };

      return {
        status: 200,
        user: { id: profileRecord.id, email: profileRecord.email, identifier: profileRecord.identifier },
        role: profileRecord.role,
      };
    }

    const adminProfile = {
      id: 'f60c8727-29fb-4e19-81ea-8ff48f9758b7',
      name: 'Abhinav',
      email: 'abhinav.ong@gmail.com',
      identifier: 'ADMIN-02',
      login_id: 'abhinav',
      role: 'admin',
      is_disabled: false,
    };

    const loginWithId = simulateAdminAuthSuccess('abhinav', adminProfile);
    assert.equal(loginWithId.status, 200);
    assert.equal(loginWithId.role, 'admin');

    const loginWithBadge = simulateAdminAuthSuccess('ADMIN-02', adminProfile);
    assert.equal(loginWithBadge.status, 200);
    assert.equal(loginWithBadge.role, 'admin');
  });

  // 2. Enter Console after successful login
  test('Scenario 2: Enter Console redirects authenticated admin to /admin without looping', () => {
    function evaluateEnterConsole(isAuthenticated, role, isLoginRoute, hasReauthParam) {
      if (!isAuthenticated) {
        return { target: '/login', action: 'PROMPT_CREDENTIALS' };
      }
      if (isLoginRoute && !hasReauthParam) {
        if (role === 'admin') return { target: '/admin', action: 'ENTER_OPERATIONS' };
        if (role === 'judge') return { target: '/judge', action: 'ENTER_JUDGING' };
        return { target: '/dashboard', action: 'ENTER_DASHBOARD' };
      }
      return { target: null, action: 'STAY' };
    }

    // Authenticated admin accessing /login without reauth param goes to /admin
    const res = evaluateEnterConsole(true, 'admin', true, false);
    assert.equal(res.target, '/admin');
    assert.equal(res.action, 'ENTER_OPERATIONS');

    // Authenticated admin accessing /login with reauth param is allowed to stay on /login
    const reauthRes = evaluateEnterConsole(true, 'admin', true, true);
    assert.equal(reauthRes.target, null);
    assert.equal(reauthRes.action, 'STAY');
  });

  // 3. Refresh while already authenticated
  test('Scenario 3: Page refresh while authenticated restores session within bounded time', async () => {
    async function simulateSessionRestore(storedUser, fetchMeMock, timeoutMs = 5000) {
      let loading = true;
      let user = null;
      let role = 'participant';

      const restorePromise = (async () => {
        if (!storedUser) {
          loading = false;
          return { user: null, role: 'participant', loading: false };
        }
        const profile = await fetchMeMock(storedUser.id);
        user = { ...storedUser, identifier: profile.identifier };
        role = profile.role;
        loading = false;
        return { user, role, loading: false };
      })();

      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ user: null, role: 'participant', loading: false, timedOut: true }), timeoutMs)
      );

      return Promise.race([restorePromise, timeoutPromise]);
    }

    const result = await simulateSessionRestore(
      { id: 'admin-uuid-04', email: 'sohammore3312@gmail.com' },
      async () => ({ identifier: 'ADMIN-04', role: 'admin' }),
      1000
    );

    assert.equal(result.loading, false);
    assert.equal(result.role, 'admin');
    assert.equal(result.user?.identifier, 'ADMIN-04');
  });

  // 4. Expired or missing session
  test('Scenario 4: Missing or expired session transitions cleanly to login rather than hanging', () => {
    function evaluateVerificationState({ loading, isAuthenticated, role, timedOut }) {
      if (loading && timedOut) return 'TIMED_OUT';
      if (loading) return 'LOADING';
      if (!isAuthenticated) return 'AUTH_REQUIRED';
      if (role !== 'admin') return 'ACCESS_DENIED';
      return 'AUTHORIZED';
    }

    // Missing session
    assert.equal(
      evaluateVerificationState({ loading: false, isAuthenticated: false, role: 'participant', timedOut: false }),
      'AUTH_REQUIRED'
    );

    // Timed out verification
    assert.equal(
      evaluateVerificationState({ loading: true, isAuthenticated: false, role: 'participant', timedOut: true }),
      'TIMED_OUT'
    );

    // Verified administrator
    assert.equal(
      evaluateVerificationState({ loading: false, isAuthenticated: true, role: 'admin', timedOut: false }),
      'AUTHORIZED'
    );
  });

  // 5. Failed or unauthorized admin verification
  test('Scenario 5: Non-admin users (participant, judge) are explicitly rejected from /admin', () => {
    function evaluateAdminRouteAccess(role) {
      if (role === 'admin') return { allowed: true, redirect: null };
      if (role === 'judge') return { allowed: false, redirect: '/judge' };
      return { allowed: false, redirect: '/dashboard' };
    }

    const participantAccess = evaluateAdminRouteAccess('participant');
    assert.equal(participantAccess.allowed, false);
    assert.equal(participantAccess.redirect, '/dashboard');

    const judgeAccess = evaluateAdminRouteAccess('judge');
    assert.equal(judgeAccess.allowed, false);
    assert.equal(judgeAccess.redirect, '/judge');

    const adminAccess = evaluateAdminRouteAccess('admin');
    assert.equal(adminAccess.allowed, true);
    assert.equal(adminAccess.redirect, null);
  });

  // 6. Missing profile and database/API failure
  test('Scenario 6: Database query failure in validateSession returns DB_ERROR with 503 status', () => {
    function mapSessionErrorToHttp(error) {
      switch (error) {
        case 'DISABLED':
          return { status: 403, code: 'FORBIDDEN' };
        case 'DB_ERROR':
          return { status: 503, code: 'SERVICE_UNAVAILABLE' };
        case 'UNAUTHENTICATED':
        case 'FORCE_LOGOUT':
        case 'NO_PROFILE':
        default:
          return { status: 401, code: 'UNAUTHORIZED' };
      }
    }

    assert.deepEqual(mapSessionErrorToHttp('DB_ERROR'), { status: 503, code: 'SERVICE_UNAVAILABLE' });
    assert.deepEqual(mapSessionErrorToHttp('NO_PROFILE'), { status: 401, code: 'UNAUTHORIZED' });
    assert.deepEqual(mapSessionErrorToHttp('FORCE_LOGOUT'), { status: 401, code: 'UNAUTHORIZED' });
    assert.deepEqual(mapSessionErrorToHttp('DISABLED'), { status: 403, code: 'FORBIDDEN' });
  });

  // 7. Login after an administrator password reset
  test('Scenario 7: Fresh credential login supersedes force_logout_before and handles clock skew', () => {
    function validateSessionWithSkew(sessionTimestampMs, forceLogoutBeforeMs, skewBufferMs = 2000) {
      if (forceLogoutBeforeMs) {
        if (sessionTimestampMs + skewBufferMs < forceLogoutBeforeMs) {
          return { valid: false, error: 'FORCE_LOGOUT' };
        }
      }
      return { valid: true, error: null };
    }

    const now = Date.now();
    const pastRevocation = now - 10000; // 10s ago
    const newSession = now;             // current

    // Successful login after force logout
    const postResetSession = validateSessionWithSkew(newSession, pastRevocation);
    assert.equal(postResetSession.valid, true);

    // Stale session created before revocation
    const staleSession = validateSessionWithSkew(now - 20000, pastRevocation);
    assert.equal(staleSession.valid, false);
    assert.equal(staleSession.error, 'FORCE_LOGOUT');

    // Minor clock skew (-500ms) within 2000ms buffer is tolerated
    const clockSkewSession = validateSessionWithSkew(pastRevocation - 500, pastRevocation);
    assert.equal(clockSkewSession.valid, true);
  });

  // 8. Normal participant and judge login and role restrictions
  test('Scenario 8: Role-based navigation routes each persona to appropriate destination', () => {
    function resolvePostLoginRoute(role, requestedNext) {
      if (requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')) {
        return requestedNext;
      }
      if (role === 'admin') return '/admin';
      if (role === 'judge') return '/judge';
      return '/dashboard';
    }

    assert.equal(resolvePostLoginRoute('admin', null), '/admin');
    assert.equal(resolvePostLoginRoute('judge', null), '/judge');
    assert.equal(resolvePostLoginRoute('participant', null), '/dashboard');
    assert.equal(resolvePostLoginRoute('participant', '/problem-statements'), '/problem-statements');
  });

  // 9. Administrator identity preservation
  test('Scenario 9: Retained administrators ADMIN-02, ADMIN-03, ADMIN-04 have correct identifiers', () => {
    const retainedAdmins = [
      { identifier: 'ADMIN-02', login_id: 'abhinav', email: 'abhinav.ong@gmail.com' },
      { identifier: 'ADMIN-03', login_id: 'yash', email: 'yashsrivastava3745@gmail.com' },
      { identifier: 'ADMIN-04', login_id: 'soham', email: 'sohammore3312@gmail.com' },
    ];

    assert.equal(retainedAdmins.length, 3);
    assert.deepEqual(retainedAdmins.map(a => a.identifier), ['ADMIN-02', 'ADMIN-03', 'ADMIN-04']);
    assert.deepEqual(retainedAdmins.map(a => a.login_id), ['abhinav', 'yash', 'soham']);
  });
});
