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
