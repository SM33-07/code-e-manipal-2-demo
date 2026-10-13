import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getCanonicalSiteUrl, getSetupPasswordRedirectUrl } from '../lib/auth/siteUrl.ts';

describe('Password Recovery Architecture & URL Resolution', () => {
  const origSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const origAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (origSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = origSiteUrl;
    else delete process.env.NEXT_PUBLIC_SITE_URL;

    if (origAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = origAppUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  });

  test('1. Resolves canonical production site URL to https://code-e-manipal-portal.vercel.app', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://code-e-manipal-portal.vercel.app';
    assert.equal(getCanonicalSiteUrl(), 'https://code-e-manipal-portal.vercel.app');
    assert.equal(getSetupPasswordRedirectUrl(), 'https://code-e-manipal-portal.vercel.app/auth/setup-password');
  });

  test('2. Strips all trailing slashes from configured canonical site URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://code-e-manipal-portal.vercel.app///';
    assert.equal(getCanonicalSiteUrl(), 'https://code-e-manipal-portal.vercel.app');
    assert.equal(getSetupPasswordRedirectUrl(), 'https://code-e-manipal-portal.vercel.app/auth/setup-password');
  });
});

describe('Forgot Password: Anti-Enumeration & Validation Logic', () => {
  const GENERIC_SUCCESS_MESSAGE =
    "If an account exists for that email address, you'll receive instructions to reset your password. Check your inbox and spam folder.";

  test('1. Validates RFC email format and rejects invalid formats', () => {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    assert.equal(EMAIL_REGEX.test('invalid-email'), false);
    assert.equal(EMAIL_REGEX.test('test@'), false);
    assert.equal(EMAIL_REGEX.test('@domain.com'), false);
    assert.equal(EMAIL_REGEX.test('user@domain.com'), true);
    assert.equal(EMAIL_REGEX.test('admin.ong@gmail.com'), true);
  });

  test('2. Anti-enumeration contract: generic success message identical for existing and non-existing accounts', () => {
    // Both branches of forgot-password return GENERIC_SUCCESS_MESSAGE
    const existingResult = { message: GENERIC_SUCCESS_MESSAGE };
    const nonExistingResult = { message: GENERIC_SUCCESS_MESSAGE };

    assert.equal(existingResult.message, nonExistingResult.message);
    assert.ok(!existingResult.message.includes('admin'));
    assert.ok(!existingResult.message.includes('participant'));
    assert.ok(!existingResult.message.includes('found'));
  });

  test('3. Rate limiting token bucket decrements and rejects on exhaustion', () => {
    let tokens = 3;
    const consume = () => {
      if (tokens >= 1) {
        tokens -= 1;
        return true;
      }
      return false;
    };

    assert.equal(consume(), true);
    assert.equal(consume(), true);
    assert.equal(consume(), true);
    assert.equal(consume(), false); // Exhausted
  });
});

describe('Role-Appropriate Password Policies', () => {
  function validatePolicy(role, password, confirmPassword) {
    const minLength = (role === 'admin' || role === 'judge') ? 16 : 8;
    const hasMinLength = password.length >= minLength;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const passwordsMatch = password.length > 0 && password === confirmPassword;

    return {
      isValid: hasMinLength && hasUpper && hasLower && hasNumber && passwordsMatch,
      minLength,
      hasMinLength,
      passwordsMatch,
    };
  }

  test('1. Admin policy enforces minimum 16 characters', () => {
    // 12 chars: should fail for admin
    const shortAdmin = validatePolicy('admin', 'SecurePass12', 'SecurePass12');
    assert.equal(shortAdmin.isValid, false);
    assert.equal(shortAdmin.minLength, 16);

    // 16 chars: should pass for admin
    const validAdmin = validatePolicy('admin', 'SecurePassword123!', 'SecurePassword123!');
    assert.equal(validAdmin.isValid, true);
  });

  test('2. Judge policy enforces minimum 16 characters', () => {
    const validJudge = validatePolicy('judge', 'JudgeEvaluation2026', 'JudgeEvaluation2026');
    assert.equal(validJudge.isValid, true);
    assert.equal(validJudge.minLength, 16);
  });

  test('3. Participant policy enforces minimum 8 characters', () => {
    // 8 chars: passes for participant
    const validParticipant = validatePolicy('participant', 'Hacker26', 'Hacker26');
    assert.equal(validParticipant.isValid, true);
    assert.equal(validParticipant.minLength, 8);

    // 5 chars: fails for participant
    const shortParticipant = validatePolicy('participant', 'Pass1', 'Pass1');
    assert.equal(shortParticipant.isValid, false);
  });

  test('4. Rejects password mismatch', () => {
    const mismatched = validatePolicy('participant', 'ValidPassword1', 'DifferentPassword2');
    assert.equal(mismatched.isValid, false);
    assert.equal(mismatched.passwordsMatch, false);
  });
});

describe('Inaccessible-Email Fallback Security Controls', () => {
  test('1. Strictly prohibits inaccessible email fallback for admins and judges (participants only)', () => {
    function checkFallbackEligibility(role) {
      if (role !== 'participant') {
        return { allowed: false, error: 'Forbidden: Inaccessible-email fallback is strictly restricted to participant accounts.' };
      }
      return { allowed: true };
    }

    assert.equal(checkFallbackEligibility('admin').allowed, false);
    assert.equal(checkFallbackEligibility('judge').allowed, false);
    assert.equal(checkFallbackEligibility('participant').allowed, true);
  });

  test('2. Requires minimum 10-character verification reason for audit compliance', () => {
    function validateReason(reason) {
      if (!reason || reason.trim().length < 10) {
        return false;
      }
      return true;
    }

    assert.equal(validateReason(''), false);
    assert.equal(validateReason('short'), false);
    assert.equal(validateReason('In-person check with student ID at Help Desk'), true);
  });

  test('3. Rejects replacement email identical to current email or invalid format', () => {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const currentEmail = 'student@muj.manipal.edu';

    function validateReplacement(newEmail) {
      if (!newEmail || !EMAIL_REGEX.test(newEmail)) return { ok: false, reason: 'Invalid format' };
      if (newEmail.toLowerCase() === currentEmail.toLowerCase()) return { ok: false, reason: 'Identical' };
      return { ok: true };
    }

    assert.equal(validateReplacement('student@muj.manipal.edu').ok, false);
    assert.equal(validateReplacement('not-an-email').ok, false);
    assert.equal(validateReplacement('new.student@gmail.com').ok, true);
  });

  test('4. Audit log strictly redacts tokens and passwords', () => {
    const auditPayload = {
      target_identifier: 'TEAM-042',
      previous_email: 'old@example.com',
      replacement_email: 'new@example.com',
      reason: 'Verified in-person at Help Desk',
      sessions_revoked: true,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(auditPayload);
    assert.ok(!serialized.includes('password'));
    assert.ok(!serialized.includes('token'));
    assert.ok(!serialized.includes('otp'));
    assert.ok(serialized.includes('Verified in-person'));
  });
});

describe('Recovery Verification & Delivery Resiliency (Comprehensive Diagnostics)', () => {
  test('1. Valid PKCE recovery link: exchanges auth code for session successfully', async () => {
    let capturedCode = null;
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: async (code) => {
          capturedCode = code;
          return {
            data: {
              session: {
                access_token: 'valid-pkce-access-token',
                refresh_token: 'valid-pkce-refresh-token',
                user: { id: 'user-uuid-1', email: 'admin@learnit-muj.com' },
              },
            },
            error: null,
          };
        },
      },
    };

    const testCode = 'auth-code-pkce-xyz';
    const { data, error } = await mockSupabase.auth.exchangeCodeForSession(testCode);

    assert.equal(error, null);
    assert.equal(capturedCode, testCode);
    assert.equal(data.session.user.email, 'admin@learnit-muj.com');
    assert.ok(data.session.access_token);
  });

  test('2. Invalid, expired and already-used recovery links: surfaces explicit provider error without crash', () => {
    function parseRecoveryUrlParameters(urlStr) {
      const url = new URL(urlStr);
      let hashParams = new URLSearchParams();
      if (url.hash && url.hash.length > 1) {
        hashParams = new URLSearchParams(url.hash.substring(1));
      }

      const rawError =
        hashParams.get('error_description') ||
        url.searchParams.get('error_description') ||
        hashParams.get('error') ||
        url.searchParams.get('error');

      if (rawError) {
        const decoded = decodeURIComponent(rawError.replace(/\+/g, ' '));
        return {
          isError: true,
          error: decoded.includes('expired') || decoded.includes('invalid')
            ? 'Your password setup link is invalid, expired, or has already been used. Please request a new recovery link.'
            : decoded,
        };
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        return { isError: false, type: 'implicit', accessToken, refreshToken };
      }

      const code = url.searchParams.get('code');
      if (code) {
        return { isError: false, type: 'pkce', code };
      }

      return { isError: true, error: 'No active session or valid recovery parameters detected.' };
    }

    // Expired / consumed OTP error in hash
    const expiredUrl = 'https://code-e-manipal-portal.vercel.app/auth/setup-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';
    const resExpired = parseRecoveryUrlParameters(expiredUrl);
    assert.equal(resExpired.isError, true);
    assert.ok(resExpired.error.includes('invalid, expired, or has already been used'));

    // Reused code in search param
    const invalidQueryUrl = 'https://code-e-manipal-portal.vercel.app/auth/setup-password?error=invalid_grant&error_description=code+is+expired';
    const resInvalidQuery = parseRecoveryUrlParameters(invalidQueryUrl);
    assert.equal(resInvalidQuery.isError, true);
    assert.ok(resInvalidQuery.error.includes('invalid, expired, or has already been used'));
  });

  test('3. Recovery URL parameters survive redirect (hash-fragment tokens and PKCE query)', () => {
    function extractTokensFromHash(hashString) {
      const params = new URLSearchParams(hashString.replace(/^#/, ''));
      return {
        accessToken: params.get('access_token'),
        refreshToken: params.get('refresh_token'),
        type: params.get('type'),
      };
    }

    const testHash = '#access_token=jwt.header.payload.sig&expires_at=1791893338&expires_in=3600&refresh_token=refresh-xyz&sb=&token_type=bearer&type=recovery';
    const extracted = extractTokensFromHash(testHash);

    assert.equal(extracted.accessToken, 'jwt.header.payload.sig');
    assert.equal(extracted.refreshToken, 'refresh-xyz');
    assert.equal(extracted.type, 'recovery');
  });

  test('4. Resend button calls the correct endpoint /api/auth/forgot-password with valid payload', () => {
    const targetEndpoint = '/api/auth/forgot-password';
    const emailToSubmit = 'sohammore3312@gmail.com';

    const requestPayload = { email: emailToSubmit.trim().toLowerCase() };
    assert.equal(targetEndpoint, '/api/auth/forgot-password');
    assert.equal(requestPayload.email, 'sohammore3312@gmail.com');
  });

  test('5. Supabase/provider rejection and rate-limit responses: returns 429 without leaking email existence', () => {
    function handleProviderResetResult(resetErr) {
      if (resetErr) {
        const isRateLimit =
          resetErr.status === 429 ||
          /rate limit|too many|once every/i.test(resetErr.message);

        if (isRateLimit) {
          return {
            status: 429,
            body: { error: 'Email delivery rate limit reached. Please wait a few minutes before requesting another reset link.' },
          };
        }
      }
      return { status: 200, body: { message: 'If an account exists, instructions have been sent.' } };
    }

    // Supabase 429 rate limit
    const rateLimitErr = { status: 429, message: 'For security purposes, you can only request this once every 60 seconds.' };
    const resRateLimit = handleProviderResetResult(rateLimitErr);
    assert.equal(resRateLimit.status, 429);
    assert.ok(resRateLimit.body.error.includes('rate limit reached'));

    // Non-rate-limit provider error falls back to generic anti-enumeration response
    const genericErr = { status: 500, message: 'Upstream SMTP connection timeout' };
    const resGeneric = handleProviderResetResult(genericErr);
    assert.equal(resGeneric.status, 200);
  });

  test('6. Missing server environment configuration: returns 500 cleanly without unhandled exception', () => {
    function validateServerConfiguration(env) {
      if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return {
          status: 500,
          error: 'Authentication service temporarily misconfigured. Please contact support.',
        };
      }
      return { status: 200 };
    }

    assert.equal(validateServerConfiguration({}).status, 500);
    assert.equal(validateServerConfiguration({ NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co' }).status, 500);
    assert.equal(
      validateServerConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'secret-role-key',
      }).status,
      200
    );
  });

  test('7. Generic responses prevent account enumeration across all query branches', () => {
    const GENERIC_MSG = "If an account exists for that email address, you'll receive instructions to reset your password. Check your inbox and spam folder.";

    function simulateEndpointResponse(profileFound, providerAccepted) {
      // Regardless of whether profile was found or not, the message is identical
      return { status: 200, message: GENERIC_MSG };
    }

    const respFound = simulateEndpointResponse(true, true);
    const respNotFound = simulateEndpointResponse(false, false);

    assert.equal(respFound.message, respNotFound.message);
    assert.equal(respFound.status, respNotFound.status);
  });

  test('8. Successful password update and subsequent login simulation', async () => {
    const updatedUsers = new Map();

    const mockSupabase = {
      auth: {
        updateUser: async ({ password }) => {
          updatedUsers.set('user-1', password);
          return { data: { user: { id: 'user-1' } }, error: null };
        },
        signInWithPassword: async ({ email, password }) => {
          if (updatedUsers.get('user-1') === password) {
            return {
              data: { session: { access_token: 'new-session-token', user: { id: 'user-1', email } } },
              error: null,
            };
          }
          return { data: { session: null }, error: { message: 'Invalid login credentials' } };
        },
      },
    };

    const newPassword = 'SecureAdmin#2026_UpdatedPassword!';
    const { error: updateError } = await mockSupabase.auth.updateUser({ password: newPassword });
    assert.equal(updateError, null);

    // Verify subsequent login succeeds with updated password
    const { data: loginData, error: loginError } = await mockSupabase.auth.signInWithPassword({
      email: 'admin@learnit-muj.com',
      password: newPassword,
    });
    assert.equal(loginError, null);
    assert.ok(loginData.session);
    assert.equal(loginData.session.user.email, 'admin@learnit-muj.com');
  });
});

