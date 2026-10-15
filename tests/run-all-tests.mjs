import { execSync } from 'child_process';

const testFiles = [
  'tests/identifier-normalization.test.mjs',
  'tests/login-auth-flow.test.mjs',
  'tests/auth-session-hydration.test.mjs',
  'tests/problem-statements-isr.test.mjs',
  'tests/team-invitation-concurrency.test.mjs',
  'tests/image-config.test.mjs',
  'tests/password-recovery-flow.test.mjs',
  'tests/invitation-delivery.test.mjs',
  'tests/provisioning.test.mjs',
  'tests/csv-formula-injection.test.mjs',
  'tests/inaccessible-email-recovery.test.mjs',
  'tests/staging-reconciliation-recovery.test.mjs',
  'tests/reconciliation-audit.test.mjs',
  'tests/admin-setup-link-e2e.test.mjs',
  'tests/admin-verification-loading-fix.test.mjs',
  'tests/admin-panel-user-management.test.mjs',
  'tests/login-security-enforcement.test.mjs',
  'tests/timeline-management.test.mjs',
  'tests/problem-statement-management.test.mjs',
  'tests/team-session-limit.test.mjs',
  'tests/submission-isolation.test.mjs',
  'tests/canonical-scheduler-operations.test.mjs',
  'tests/problem-statement-cms.test.mjs',
  'tests/judge-role-boundaries.test.mjs',
  'tests/all-three-categories-real-login.test.mjs',
  'tests/judge-password-reset-by-admin.test.mjs',
  'tests/problem-statements-catalog-35.test.mjs',
  'tests/final-participant-roster-acceptance.test.mjs',
];

let totalPassed = 0;
let totalFailed = 0;

console.log('Running All Pre-Merge Verification Test Suites...\n');

const envFile = process.env.ENV_FILE || '.env.staging';

for (const f of testFiles) {
  try {
    let runner = 'node';
    if (f.includes('canonical-scheduler') || f.includes('problem-statement-cms')) {
      runner = 'npx tsx';
    } else if (f.includes('team-session-limit') || f.includes('submission-isolation') || f.includes('problem-statements-catalog-35')) {
      runner = 'node --test';
    }
    const out = execSync(`${runner} --env-file=${envFile} ${f}`, { encoding: 'utf8' });
    const passMatch = out.match(/pass (\d+)/i) || out.match(/(\d+)\s*\/\s*\d+\s*passed/i) || out.match(/(\d+)\s+passed/i);
    const passes = passMatch ? parseInt(passMatch[1], 10) : 0;
    totalPassed += passes;
    console.log(`✅ ${f}: ${passes} passed`);
  } catch (err) {
    totalFailed++;
    console.error(`❌ ${f} failed:`, err.stdout || err.message);
  }
}

console.log('\n=========================================');
console.log(`Total Test Suites Executed: ${testFiles.length}`);
console.log(`Total Tests Passed: ${totalPassed}`);
console.log(`Total Test Suite Failures: ${totalFailed}`);
console.log('=========================================');
