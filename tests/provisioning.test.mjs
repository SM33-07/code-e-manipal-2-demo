import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  validateRoster,
  allocateNextIdentifier,
  normalizeLoginId,
} from '../scripts/provision-admin-judge.mjs';

describe('Admin & Judge Provisioning: Roster & Invariant Validation', () => {
  test('1. Validates real admin roster successfully', () => {
    const adminRosterPath = path.resolve(process.cwd(), 'data/rosters/admins.json');
    assert.ok(fs.existsSync(adminRosterPath), 'admins.json should exist');
    const content = JSON.parse(fs.readFileSync(adminRosterPath, 'utf8'));

    const { errors, validRecords } = validateRoster(content.admins);
    assert.equal(errors.length, 0, `Expected 0 errors, got: ${errors.join(', ')}`);
    assert.equal(validRecords.length, 3, 'Expected exactly 3 valid admin records');

    const emails = validRecords.map(r => r.email);
    assert.ok(emails.includes('abhinav.ong@gmail.com'));
    assert.ok(emails.includes('yashsrivastava3745@gmail.com'));
    assert.ok(emails.includes('sohammore3312@gmail.com'));

    // Regression: ADMIN-01 and bootstrap email must NOT be present in active roster
    assert.ok(!emails.includes('admin@learnit-muj.com'), 'admin@learnit-muj.com must not be in active roster');
    const identifiers = validRecords.map(r => r.target_identifier);
    assert.ok(!identifiers.includes('ADMIN-01'), 'ADMIN-01 must not be in active roster');
  });

  test('2. Rejects placeholder template data with clear errors', () => {
    const judgeTemplatePath = path.resolve(process.cwd(), 'data/rosters/judges.template.json');
    assert.ok(fs.existsSync(judgeTemplatePath), 'judges.template.json should exist');
    const content = JSON.parse(fs.readFileSync(judgeTemplatePath, 'utf8'));

    const { errors } = validateRoster(content.judges);
    assert.ok(errors.length > 0, 'Placeholder template must fail preflight validation');
    assert.ok(
      errors.some(e => e.includes('contains placeholder text')),
      'Should report placeholder text in records'
    );
  });

  test('3. Rejects invalid roles', () => {
    const badRoster = [
      { name: 'Alice', email: 'alice@domain.org', role: 'superadmin' },
      { name: 'Bob', email: 'bob@domain.org', role: 'participant' },
    ];
    const { errors } = validateRoster(badRoster);
    assert.equal(errors.length, 2);
    assert.ok(errors[0].includes('Allowed roles: "admin", "judge"'));
    assert.ok(errors[1].includes('Allowed roles: "admin", "judge"'));
  });

  test('4. Rejects duplicate emails and duplicate proposed logins within batch', () => {
    const dupeRoster = [
      { name: 'Admin One', email: 'test@domain.org', role: 'admin', proposed_login_id: 'adm1' },
      { name: 'Admin Two', email: 'test@domain.org', role: 'admin', proposed_login_id: 'adm1' },
    ];
    const { errors } = validateRoster(dupeRoster);
    assert.ok(errors.some(e => e.includes('Duplicate email')));
    assert.ok(errors.some(e => e.includes('Duplicate proposed login ID')));
  });

  test('5. Rejects malformed RFC email addresses', () => {
    const malformedRoster = [
      { name: 'Bad Email', email: 'not-an-email', role: 'admin' },
      { name: 'Missing Domain', email: 'user@', role: 'judge' },
    ];
    const { errors } = validateRoster(malformedRoster);
    assert.equal(errors.length, 2);
    assert.ok(errors[0].includes('not a valid email address'));
    assert.ok(errors[1].includes('not a valid email address'));
  });
});

describe('Canonical Identifier & Login Allocation', () => {
  test('1. Allocates next admin identifier correctly after existing max', () => {
    const existingAdmins = ['ADMIN-01'];
    const next1 = allocateNextIdentifier('admin', existingAdmins);
    assert.equal(next1, 'ADMIN-02');

    const next2 = allocateNextIdentifier('admin', [...existingAdmins, next1]);
    assert.equal(next2, 'ADMIN-03');
  });

  test('2. Allocates next judge identifier correctly after existing max', () => {
    const existingJudges = ['JUDGE-01'];
    const next1 = allocateNextIdentifier('judge', existingJudges);
    assert.equal(next1, 'JUDGE-02');

    const next2 = allocateNextIdentifier('judge', [...existingJudges, next1]);
    assert.equal(next2, 'JUDGE-03');
  });

  test('3. Normalizes login IDs and handles collisions safely', () => {
    const existingLogins = new Set(['johndoe', 'sarah']);
    const login1 = normalizeLoginId('John Doe', 'judge', existingLogins);
    assert.equal(login1, 'johndoe2', 'Should disambiguate with counter on collision');

    const login2 = normalizeLoginId('Alice Smith', 'judge', existingLogins);
    assert.equal(login2, 'alicesmith', 'Should lowercase and remove punctuation');
  });
});

describe('Password Setup UI & API Contract', () => {
  test('1. Setup password page enforces min 16 characters for admins and judges', () => {
    const setupPagePath = path.resolve(process.cwd(), 'app/auth/setup-password/page.tsx');
    assert.ok(fs.existsSync(setupPagePath), 'setup-password page should exist');
    const content = fs.readFileSync(setupPagePath, 'utf8');

    assert.ok(content.includes('const minLength = 16'), 'Must enforce minimum length of 16 characters');
    assert.ok(content.includes('hasMinLength'), 'Must validate minimum length condition');
    assert.ok(content.includes('supabase.auth.updateUser'), 'Must update password via Supabase Auth');
  });

  test('2. Setup password API route enforces session auth & logs audit event without password leaks', () => {
    const setupApiRoute = path.resolve(process.cwd(), 'app/api/auth/setup-password/route.ts');
    assert.ok(fs.existsSync(setupApiRoute), 'setup-password API route should exist');
    const content = fs.readFileSync(setupApiRoute, 'utf8');

    assert.ok(content.includes('USER_PASSWORD_SETUP_COMPLETED'), 'Must log audit event');
    assert.ok(content.includes('force_logout_before = NULL'), 'Must clear force_logout_before');
    // Ensure the endpoint does not extract or accept a password parameter in body
    assert.ok(!content.includes('body.password'), 'Must not accept plaintext password in request body');
  });

  test('3. Audit log API restricts to admins and queries authoritative audit_logs', () => {
    const auditRoute = path.resolve(process.cwd(), 'app/api/admin/audit-logs/route.ts');
    assert.ok(fs.existsSync(auditRoute), 'audit-logs API route should exist');
    const content = fs.readFileSync(auditRoute, 'utf8');

    assert.ok(content.includes("withAuth(async"), 'Must protect route with withAuth middleware');
    assert.ok(content.includes("'admin'"), 'Must require admin role');
    assert.ok(content.includes('public.audit_logs'), 'Must query authoritative public.audit_logs');
  });
});

describe('Alphanumeric Participant Roster & Provisioning Pipeline', () => {
  const csvPath = path.resolve(process.cwd(), 'code_e_manipal_team_leader_logins_alphanumeric.csv');
  const hasAlphanumericCsv = fs.existsSync(csvPath);

  test('1. Validates authoritative alphanumeric CSV with exact 86 rows and correct formats', { skip: !hasAlphanumericCsv }, async () => {
    assert.ok(fs.existsSync(csvPath), 'Authoritative CSV must exist');
    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(content);
    const result = validateRoster(rows);

    assert.equal(result.valid, true, `CSV must be valid: ${result.errors.join(', ')}`);
    assert.equal(result.totalTeams, 86, 'Expected exactly 86 teams in roster');
    assert.equal(result.duplicateNames.length, 0, 'Zero duplicate team names allowed');

    // All passcodes must be 8 alphanumeric chars with letters and digits
    for (const team of result.teams) {
      assert.equal(team.passcode.length, 8);
      assert.match(team.passcode, /^[a-zA-Z0-9]{8}$/);
      assert.match(team.passcode, /[a-zA-Z]/);
      assert.match(team.passcode, /[0-9]/);
    }
  });

  test('2. Rejects malformed passcodes (less than 8 chars, numbers-only, letters-only)', async () => {
    const { validateRoster } = await import('../scripts/validate-csv.mjs');
    const header = ['Team ID', 'Team Name', 'Login ID', 'Temporary Passcode', 'Primary Contact (verify team leader)', 'Contact Email'];
    const badRows = [
      header,
      ['TEAM001', 'Team One', 'TEAM001', '12345678', 'Leader One', 'lead1@gmail.com'], // numbers only
      ['TEAM002', 'Team Two', 'TEAM002', 'abcdefgh', 'Leader Two', 'lead2@gmail.com'], // letters only
      ['TEAM003', 'Team Three', 'TEAM003', 'Short5', 'Leader Three', 'lead3@gmail.com'],   // 6 chars
      ['TEAM004', 'Team Four', 'TEAM004', 'TooLongPass123', 'Leader Four', 'lead4@gmail.com'], // 14 chars
    ];
    const result = validateRoster(badRows);
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 4);
  });

  test('3. Correctly normalizes student ID and non-email contact identifiers to canonical identities', async () => {
    const { normalizeRosterEmail } = await import('../scripts/validate-csv.mjs');
    // MUJ student ID without domain
    const mujNorm = normalizeRosterEmail('TEAM074', 'samreen.2502051478');
    assert.equal(mujNorm.email, 'samreen.2502051478@muj.manipal.edu');
    assert.equal(mujNorm.normalized, true);

    // Non-email token
    const tokenNorm = normalizeRosterEmail('TEAM024', 'Lotna');
    assert.equal(tokenNorm.email, 'team-024@auth.codeemanipal.in');
    assert.equal(tokenNorm.normalized, true);

    // Regular valid email is untouched
    const normal = normalizeRosterEmail('TEAM001', 'valid.user@gmail.com');
    assert.equal(normal.email, 'valid.user@gmail.com');
    assert.equal(normal.normalized, false);
  });

  test('4. Admin reset route enforces role-specific password policies', () => {
    const resetRoutePath = path.resolve(process.cwd(), 'app/api/admin/users/[id]/reset-password/route.ts');
    assert.ok(fs.existsSync(resetRoutePath), 'reset-password route must exist');
    const content = fs.readFileSync(resetRoutePath, 'utf8');

    // Participant policy
    assert.ok(content.includes('generateParticipantPasscode(8)'), 'Must use 8-char participant passcode generator');
    assert.ok(content.includes('newPassword.length !== 8'), 'Must validate 8-char length for participants on custom reset');

    // Admin & Judge policies
    assert.ok(content.includes('generateAdminPassword(18)'), 'Must use 18-char admin password generator');
    assert.ok(content.includes('generateJudgePassword(16)'), 'Must use 16-char judge password generator');

    // Cache-Control: no-store
    assert.ok(content.includes('no-store'), 'Must include no-store headers');

    // Session invalidation
    assert.ok(content.includes('force_logout_before = NOW()'), 'Must invalidate sessions via force_logout_before');
  });
});
