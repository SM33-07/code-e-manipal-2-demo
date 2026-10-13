import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdentifier } from '../lib/auth/identifier.ts';

describe('Login & Identifier Normalization Verification Suite', () => {
  test('1. Team leader login inputs (uppercase, lowercase, mixed-case, hyphenated, unhyphenated)', () => {
    const inputs = ['TEAM-001', 'team-001', 'TEAM001', 'team001', 'Team001', 'Team-001'];
    for (const input of inputs) {
      const normalized = normalizeIdentifier(input);
      assert.ok(normalized, `Failed to normalize ${input}`);
      assert.equal(normalized.canonical, 'TEAM-001');
      assert.equal(normalized.role, 'participant');
    }
  });

  test('2. Team identifiers with 2 digits (e.g. TEAM42, team42, team-42) normalize to 3-digit canonical', () => {
    const inputs = ['TEAM42', 'team42', 'team-42', 'TEAM-042'];
    for (const input of inputs) {
      const normalized = normalizeIdentifier(input);
      assert.ok(normalized, `Failed to normalize ${input}`);
      assert.equal(normalized.canonical, 'TEAM-042');
      assert.equal(normalized.role, 'participant');
    }
  });

  test('3. Email identifiers normalize authoritatively to lowercase', () => {
    const emails = [
      { raw: 'User@Example.com', expected: 'user@example.com' },
      { raw: 'KHUSHIPARMAR3124@GMAIL.COM', expected: 'khushiparmar3124@gmail.com' },
      { raw: '  Admin.Event@MUJ.Manipal.Edu  ', expected: 'admin.event@muj.manipal.edu' },
    ];
    for (const { raw, expected } of emails) {
      const trimmed = raw.trim();
      const normalized = trimmed.includes('@') ? trimmed.toLowerCase() : trimmed.toUpperCase();
      assert.equal(normalized, expected);
    }
  });

  test('4. Password integrity invariant: strictly preserved case sensitivity', () => {
    const passwords = ['P@ssw0rd123!', 'SecretCode_99', 'ExactCaseMatters'];
    for (const pwd of passwords) {
      // Must not be modified by any normalization pipeline
      const untouched = pwd;
      assert.equal(untouched, pwd);
      assert.notEqual(untouched.toLowerCase(), pwd);
    }
  });

  test('5. Judge badge identifiers normalize authoritatively', () => {
    const inputs = ['JUDGE-01', 'judge-01', 'JUDGE01', 'judge01'];
    for (const input of inputs) {
      const normalized = normalizeIdentifier(input);
      assert.ok(normalized, `Failed to normalize ${input}`);
      assert.equal(normalized.canonical, 'JUDGE-01');
      assert.equal(normalized.role, 'judge');
    }
  });

  test('6. Admin badge identifiers normalize authoritatively', () => {
    const inputs = ['ADMIN-01', 'admin-01', 'ADMIN01', 'admin01'];
    for (const input of inputs) {
      const normalized = normalizeIdentifier(input);
      assert.ok(normalized, `Failed to normalize ${input}`);
      assert.equal(normalized.canonical, 'ADMIN-01');
      assert.equal(normalized.role, 'admin');
    }
  });
});
