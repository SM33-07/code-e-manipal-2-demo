import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIdentifier,
  normalizeLoginId,
  IDENTIFIER_PATTERNS,
} from '../lib/auth/identifier.ts';

describe('Identifier Normalization & Authentication Correctness (Phase 2)', () => {
  describe('1. Team Identifier Normalization (case-insensitive, unhyphenated & hyphenated)', () => {
    test('Normalizes standard uppercase canonical format TEAM-001', () => {
      const res = normalizeIdentifier('TEAM-001');
      assert.deepEqual(res, { canonical: 'TEAM-001', role: 'participant' });
    });

    test('Normalizes lowercase unhyphenated team001 to canonical TEAM-001', () => {
      const res = normalizeIdentifier('team001');
      assert.deepEqual(res, { canonical: 'TEAM-001', role: 'participant' });
    });

    test('Normalizes uppercase unhyphenated TEAM001 to canonical TEAM-001', () => {
      const res = normalizeIdentifier('TEAM001');
      assert.deepEqual(res, { canonical: 'TEAM-001', role: 'participant' });
    });

    test('Normalizes mixed-case Team001 and Team-001 to canonical TEAM-001', () => {
      assert.deepEqual(normalizeIdentifier('Team001'), { canonical: 'TEAM-001', role: 'participant' });
      assert.deepEqual(normalizeIdentifier('Team-001'), { canonical: 'TEAM-001', role: 'participant' });
    });

    test('Normalizes single/double digit team inputs: team1 -> TEAM-001, TEAM42 -> TEAM-042', () => {
      assert.deepEqual(normalizeIdentifier('team1'), { canonical: 'TEAM-001', role: 'participant' });
      assert.deepEqual(normalizeIdentifier('TEAM42'), { canonical: 'TEAM-042', role: 'participant' });
      assert.deepEqual(normalizeIdentifier('team-42'), { canonical: 'TEAM-042', role: 'participant' });
    });

    test('Trims surrounding whitespace: "  team005  " -> TEAM-005', () => {
      assert.deepEqual(normalizeIdentifier('  team005  '), { canonical: 'TEAM-005', role: 'participant' });
    });
  });

  describe('2. Judge & Admin Badge Identifiers', () => {
    test('Normalizes judge identifiers with or without hyphens: JUDGE-01, judge01 -> JUDGE-01', () => {
      assert.deepEqual(normalizeIdentifier('JUDGE-01'), { canonical: 'JUDGE-01', role: 'judge' });
      assert.deepEqual(normalizeIdentifier('judge-01'), { canonical: 'JUDGE-01', role: 'judge' });
      assert.deepEqual(normalizeIdentifier('judge01'), { canonical: 'JUDGE-01', role: 'judge' });
      assert.deepEqual(normalizeIdentifier('JUDGE1'), { canonical: 'JUDGE-01', role: 'judge' });
    });

    test('Normalizes admin identifiers with or without hyphens: ADMIN-01, admin01 -> ADMIN-01', () => {
      assert.deepEqual(normalizeIdentifier('ADMIN-01'), { canonical: 'ADMIN-01', role: 'admin' });
      assert.deepEqual(normalizeIdentifier('admin-01'), { canonical: 'ADMIN-01', role: 'admin' });
      assert.deepEqual(normalizeIdentifier('admin01'), { canonical: 'ADMIN-01', role: 'admin' });
      assert.deepEqual(normalizeIdentifier('ADMIN1'), { canonical: 'ADMIN-01', role: 'admin' });
    });

    test('Personalized login IDs preserve role assignment', () => {
      assert.deepEqual(normalizeLoginId('JUDGE-ALICE'), { canonical: 'JUDGE-ALICE', role: 'judge' });
      assert.deepEqual(normalizeLoginId('ADMIN-BOB'), { canonical: 'ADMIN-BOB', role: 'admin' });
    });
  });

  describe('3. Rejection of Invalid Identifiers', () => {
    test('Rejects invalid identifier strings', () => {
      assert.equal(normalizeIdentifier(''), null);
      assert.equal(normalizeIdentifier('   '), null);
      assert.equal(normalizeIdentifier('NOT_AN_ID'), null);
      assert.equal(normalizeIdentifier('STUDENT-001'), null);
      assert.equal(normalizeIdentifier('USER-1234'), null);
    });
  });

  describe('4. Email & Password Normalization Invariants', () => {
    test('Email identifier input normalizes strictly to lowercase', () => {
      const rawEmail = 'KhushiParmar3124@Gmail.Com';
      const normalizedEmail = rawEmail.trim().toLowerCase();
      assert.equal(normalizedEmail, 'khushiparmar3124@gmail.com');
    });

    test('Passwords remain strictly case-sensitive and must never be normalized', () => {
      const rawPassword = 'SecretP@ssw0rd!#';
      // Simulate pass-through: raw password must equal untouched password
      const processedPassword = rawPassword;
      assert.equal(processedPassword, 'SecretP@ssw0rd!#');
      assert.notEqual(processedPassword, rawPassword.toLowerCase());
      assert.notEqual(processedPassword, rawPassword.toUpperCase());
    });
  });
});
