import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { parseCSV, validateCSVRecords } from '../scripts/provision-team-leaders.mjs';
import { getPortalNavigation, publicNavigation } from '../lib/navigation/portal.ts';
import { resolveSiteUrl } from '../scripts/provision-admin-judge.mjs';
import { DEMO_ARCHIVE_MAPPINGS } from '../scripts/archive-demo-identifiers.mjs';
import {
  classifyRecords,
  PROTECTED_BOOTSTRAP_PROFILES,
  DISPOSABLE_PROFILE_TARGETS,
} from '../scripts/cleanup-demo-accounts.mjs';

describe('Cleaned Team Leader CSV Invariants (165 Records)', () => {
  const csvPath = path.resolve(process.cwd(), 'code_e_manipal_team_leader_login_ids_cleaned.csv');
  const hasCsv = fs.existsSync(csvPath);

  test('1. Cleaned CSV exists and parses exactly 165 records', { skip: !hasCsv }, () => {
    assert.ok(fs.existsSync(csvPath), 'CSV file must exist');
    const content = fs.readFileSync(csvPath, 'utf8');
    const records = parseCSV(content);
    assert.equal(records.length, 165, 'Must contain exactly 165 team leader records');
  });

  test('2. Cleaned CSV passes all preflight validation invariants without error', { skip: !hasCsv }, () => {
    const content = fs.readFileSync(csvPath, 'utf8');
    const records = parseCSV(content);
    const { errors, warnings } = validateCSVRecords(records);

    assert.equal(errors.length, 0, `Expected 0 validation errors, got: ${errors.join('; ')}`);
    // Exactly 2 known case-insensitive team name collisions disambiguated by unique registration ID
    assert.equal(warnings.length, 2, 'Expected exactly 2 team name disambiguation warnings');
  });

  test('3. Canonical identifiers cover contiguous range TEAM-001 through TEAM-165 without gaps', { skip: !hasCsv }, () => {
    const content = fs.readFileSync(csvPath, 'utf8');
    const records = parseCSV(content);
    const loginIds = records.map(r => r['Login ID']);

    for (let i = 1; i <= 165; i++) {
      const expectedId = `TEAM-${String(i).padStart(3, '0')}`;
      assert.ok(loginIds.includes(expectedId), `Must contain canonical identifier ${expectedId}`);
    }
  });

  test('4. TEAM-023 is strictly assigned to Aditya Goyal (Void Labs, U5T83P0G)', { skip: !hasCsv }, () => {
    const content = fs.readFileSync(csvPath, 'utf8');
    const records = parseCSV(content);
    const team023 = records.find(r => r['Login ID'] === 'TEAM-023');

    assert.ok(team023, 'TEAM-023 must exist');
    assert.equal(team023['Registration Team ID'], 'U5T83P0G');
    assert.equal(team023['Team Name'], 'Void Labs');
    assert.equal(team023['Team Leader Email'], 'synthreaperx@gmail.com');
  });

  test('5. TEAM-008 is strictly assigned to Aryan Sharma (3BIT7, U21G3X8L)', { skip: !hasCsv }, () => {
    const content = fs.readFileSync(csvPath, 'utf8');
    const records = parseCSV(content);
    const team008 = records.find(r => r['Login ID'] === 'TEAM-008');

    assert.ok(team008, 'TEAM-008 must exist');
    assert.equal(team008['Registration Team ID'], 'U21G3X8L');
    assert.equal(team008['Team Name'], '3BIT7');
    assert.equal(team008['Team Leader Email'], 'aryansharma24106@gmail.com');
  });
});

describe('Environment-Specific Invitation URLs & Redirection Safety', () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  test('1. Local development fallback preserves localhost when not in production or sending invites', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = resolveSiteUrl({ isProduction: false, sendInvitations: false });
    assert.equal(url, 'http://localhost:3000');
  });

  test('2. Rejects missing URL when isProduction is true', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.throws(
      () => resolveSiteUrl({ isProduction: true, sendInvitations: false }),
      /Production URL Configuration Error/
    );
  });

  test('3. Rejects missing URL when sendInvitations is true', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.throws(
      () => resolveSiteUrl({ isProduction: false, sendInvitations: true }),
      /Production URL Configuration Error/
    );
  });

  test('4. Strictly rejects localhost URL in production mode', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
    assert.throws(
      () => resolveSiteUrl({ isProduction: true, sendInvitations: false }),
      /Production Security Violation.*localhost/
    );
  });

  test('5. Strictly rejects 127.0.0.1 in production mode', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000';
    assert.throws(
      () => resolveSiteUrl({ isProduction: true, sendInvitations: false }),
      /Production Security Violation.*localhost/
    );
  });

  test('6. Accepts verified production domain', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portal.codeemanipal.in/';
    const resolved = resolveSiteUrl({ isProduction: true, sendInvitations: true });
    assert.equal(resolved, 'https://portal.codeemanipal.in');

    // Restore original env
    if (originalSiteUrl) process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
    if (originalAppUrl) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  });
});

describe('Archived Participant Identifiers & Null Login IDs', () => {
  test('1. archive-demo-identifiers.mjs specifies targetLogin: null for all participant profiles and strictly excludes Aditya', () => {
    assert.ok(Array.isArray(DEMO_ARCHIVE_MAPPINGS));
    assert.equal(DEMO_ARCHIVE_MAPPINGS.length, 6, 'Must contain exactly 6 genuine demo test accounts');
    assert.ok(
      !DEMO_ARCHIVE_MAPPINGS.some(m => m.expectedProfileId === 'e2ebabbb-5518-4027-bc6c-55b0bd3cc198'),
      'Aditya Goyal must NOT be in demo archival mappings'
    );
    DEMO_ARCHIVE_MAPPINGS.forEach(mapping => {
      assert.ok(mapping.expectedProfileId, `Mapping ${mapping.targetId} must have expectedProfileId`);
      assert.equal(mapping.targetLogin, null, `Mapping ${mapping.targetId} must have targetLogin: null`);
      assert.ok(mapping.targetId.startsWith('DEMO-TEAM-'), `Target identifier must start with DEMO-TEAM-`);
    });
  });

  test('2. archive-demo-identifiers.sql enforces login_id = NULL, immutable UUID targeting, and excludes Aditya', () => {
    const sqlPath = path.resolve(process.cwd(), 'scripts/archive-demo-identifiers.sql');
    assert.ok(fs.existsSync(sqlPath));
    const content = fs.readFileSync(sqlPath, 'utf8');

    // Must not set string login_id
    assert.ok(!content.includes("login_id = 'demo-team-"), 'Must not assign string login_id to participants');
    // Must set login_id = NULL
    assert.ok(content.includes('login_id = NULL'), 'Must set login_id = NULL for all participant profiles');
    // Must target by UUID
    assert.ok(content.includes("WHERE id = '4e41c7c9-a875-4319-b78d-36fa9638248d'"));
    assert.ok(content.includes("WHERE id = '0c5446bf-4a0e-48c2-a03c-995cfb686cf6'"));
    // Must strictly exclude Aditya Goyal
    assert.ok(
      !content.includes('e2ebabbb-5518-4027-bc6c-55b0bd3cc198'),
      'archive-demo-identifiers.sql must NOT contain Aditya Goyal profile UUID'
    );
  });

  test('3. rollback-demo-identifiers.sql enforces login_id = NULL, immutable UUID targeting, and excludes Aditya', () => {
    const sqlPath = path.resolve(process.cwd(), 'scripts/rollback-demo-identifiers.sql');
    assert.ok(fs.existsSync(sqlPath));
    const content = fs.readFileSync(sqlPath, 'utf8');

    assert.ok(!content.includes("login_id = 'TEAM-"), 'Must not assign string login_id on rollback');
    assert.ok(content.includes('login_id = NULL'), 'Must set login_id = NULL on rollback');
    assert.ok(content.includes("WHERE id = '4e41c7c9-a875-4319-b78d-36fa9638248d'"));
    assert.ok(
      !content.includes('e2ebabbb-5518-4027-bc6c-55b0bd3cc198'),
      'rollback-demo-identifiers.sql must NOT contain Aditya Goyal profile UUID'
    );
  });
});

describe('Duplicate Profile Cleanup Safety & Bootstrap Protection', () => {
  test('1. Bootstrap admin profile eb3ba0ae... is strictly protected from deletion', () => {
    assert.ok(PROTECTED_BOOTSTRAP_PROFILES.has('eb3ba0ae-c5dd-45ff-bc9f-adfec41bc446'));
    const adminBootstrap = PROTECTED_BOOTSTRAP_PROFILES.get('eb3ba0ae-c5dd-45ff-bc9f-adfec41bc446');
    assert.equal(adminBootstrap.identifier, 'ADMIN-01');
    assert.equal(adminBootstrap.role, 'admin');
  });

  test('2. Bootstrap judge profile 3f93c481... is strictly protected from deletion', () => {
    assert.ok(PROTECTED_BOOTSTRAP_PROFILES.has('3f93c481-5209-4223-a6d6-e8ac762fa372'));
    const judgeBootstrap = PROTECTED_BOOTSTRAP_PROFILES.get('3f93c481-5209-4223-a6d6-e8ac762fa372');
    assert.equal(judgeBootstrap.identifier, 'JUDGE-01');
    assert.equal(judgeBootstrap.role, 'judge');
  });

  test('3. Disposable targets isolate duplicate shadow profiles without touching bootstrap seed', () => {
    // Duplicate portal-signup profiles targeted for deletion
    assert.ok(DISPOSABLE_PROFILE_TARGETS.has('e750edc5-65f7-4512-a54e-185de733136c')); // admin shadow
    assert.ok(DISPOSABLE_PROFILE_TARGETS.has('2a86c3bd-fdbb-40e4-93d4-c90369829f00')); // judge shadow

    // Seed profiles are NOT in disposable targets
    assert.ok(!DISPOSABLE_PROFILE_TARGETS.has('eb3ba0ae-c5dd-45ff-bc9f-adfec41bc446'));
    assert.ok(!DISPOSABLE_PROFILE_TARGETS.has('3f93c481-5209-4223-a6d6-e8ac762fa372'));
  });

  test('4. classifyRecords produces distinct PRESERVE vs DELETE actions for duplicate profiles', () => {
    const mockState = {
      profiles: [
        {
          id: 'eb3ba0ae-c5dd-45ff-bc9f-adfec41bc446',
          email: 'admin@learnit-muj.com',
          name: 'admin',
          role: 'admin',
          identifier: 'ADMIN-01',
          created_at: new Date().toISOString(),
        },
        {
          id: 'e750edc5-65f7-4512-a54e-185de733136c',
          email: 'admin@learnit-muj.com',
          name: 'admin',
          role: 'admin',
          identifier: 'USER-AF10CCD7',
          created_at: new Date().toISOString(),
        },
      ],
      teams: [],
      teamMembers: [],
      shadowUsers: [],
      authUsers: [{ id: 'e750edc5-65f7-4512-a54e-185de733136c', email: 'admin@learnit-muj.com' }],
      registrations: [],
      submissions: [],
      reviews: [],
    };

    const plan = classifyRecords(mockState);

    // Bootstrap seed admin must be protected
    const protectedIds = plan.retainedProtectedRecords.map(r => r.id);
    assert.ok(protectedIds.includes('eb3ba0ae-c5dd-45ff-bc9f-adfec41bc446'));

    // Duplicate shadow profile must be targeted
    const candidateIds = plan.namedTestCandidates.map(c => c.id);
    assert.ok(candidateIds.includes('e750edc5-65f7-4512-a54e-185de733136c'));

    // Duplicate report must reflect both
    const adminReport = plan.duplicateProfilesReport.find(r => r.email === 'admin@learnit-muj.com');
    assert.ok(adminReport);
    assert.equal(adminReport.count, 2);
    const actions = adminReport.profiles.map(p => p.action);
    assert.ok(actions.includes('PRESERVE'));
    assert.ok(actions.includes('DELETE'));
  });
});

describe('Portal Navigation & Role Boundaries', () => {
  test('1. Participant navigation exposes correct portal destinations', () => {
    const items = getPortalNavigation('participant');
    const links = items.map(i => i.link);
    assert.ok(links.includes('/dashboard'));
    assert.ok(links.includes('/team'));
    assert.ok(links.includes('/submit'));
    assert.ok(links.includes('/timeline'));
    assert.ok(links.includes('/problem-statements'));
    assert.ok(links.includes('/results'));
    assert.ok(!links.includes('/judge'), 'Participant must not have judge workspace in navigation');
    assert.ok(!links.includes('/admin'), 'Participant must not have admin operations in navigation');
  });

  test('2. Judge navigation is strictly confined to judge workspace and event context', () => {
    const items = getPortalNavigation('judge');
    const links = items.map(i => i.link);
    assert.ok(links.includes('/judge'));
    assert.ok(links.includes('/timeline'));
    assert.ok(links.includes('/problem-statements'));
    assert.ok(!links.includes('/submit'), 'Judge must not submit projects');
    assert.ok(!links.includes('/team'), 'Judge must not manage teams');
    assert.ok(!links.includes('/admin'), 'Judge must not access admin routes');
  });

  test('3. Admin navigation provides supervisory access to all core domains', () => {
    const items = getPortalNavigation('admin');
    const links = items.map(i => i.link);
    assert.ok(links.includes('/admin'));
    assert.ok(links.includes('/dashboard'));
    assert.ok(links.includes('/team'));
    assert.ok(links.includes('/submit'));
    assert.ok(links.includes('/judge'));
    assert.ok(links.includes('/results'));
  });

  test('4. Public navigation contains only unauthenticated marketing & information links', () => {
    const links = publicNavigation.map(i => i.link);
    assert.deepEqual(links, ['/', '/problem-statements', '/timeline', '/faq']);
    assert.ok(!links.includes('/dashboard'), 'Public links must not include portal dashboard');
  });
});
