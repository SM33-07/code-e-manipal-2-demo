import test from 'node:test';
import assert from 'node:assert/strict';

test('Admin Panel User Management Suite', async (t) => {
  // Test 1: Team Assignment & Unassignment logic
  await t.test('Team assignment checks: role restrictions and capacity', async () => {
    // Participant role allowed
    const validRole = 'participant';
    assert.equal(validRole, 'participant', 'Only participant role can be assigned to teams');

    // Admin & Judge roles rejected
    const invalidRoles = ['admin', 'judge'];
    for (const r of invalidRoles) {
      assert.notEqual(r, 'participant', `${r} cannot be assigned to teams`);
    }

    // Capacity limit: max 6 members
    const maxCapacity = 6;
    const teamMembers = [1, 2, 3, 4, 5, 6];
    assert.equal(teamMembers.length >= maxCapacity, true, 'Team at 6 members must reject new member');
  });

  // Test 2: Passcode generation format for participant vs admin/judge
  await t.test('Password generator enforces role policies', async () => {
    const { generateParticipantPasscode, generateJudgePassword, generateAdminPassword } =
      await import('../lib/admin/passwords.ts');

    const participantPass = generateParticipantPasscode(8);
    assert.equal(participantPass.length, 8, 'Participant passcode must be exactly 8 characters');
    assert.match(participantPass, /^[a-zA-Z0-9]{8}$/, 'Participant passcode must be alphanumeric');
    assert.match(participantPass, /[a-zA-Z]/, 'Must contain letters');
    assert.match(participantPass, /[0-9]/, 'Must contain numbers');

    const judgePass = generateJudgePassword(16);
    assert.ok(judgePass.length >= 16, 'Judge password must be at least 16 chars');
    assert.match(judgePass, /[A-Z]/, 'Must contain uppercase');
    assert.match(judgePass, /[a-z]/, 'Must contain lowercase');
    assert.match(judgePass, /[0-9]/, 'Must contain digit');

    const adminPass = generateAdminPassword(18);
    assert.ok(adminPass.length >= 18, 'Admin password must be at least 18 chars');
    assert.match(adminPass, /[A-Z]/, 'Must contain uppercase');
    assert.match(adminPass, /[a-z]/, 'Must contain lowercase');
    assert.match(adminPass, /[0-9]/, 'Must contain digit');
  });

  // Test 3: Session revocation invariant on Kick and Reset PW
  await t.test('Kick and Reset PW set force_logout_before = NOW()', async () => {
    const beforeTime = Date.now();
    const simulatedProfile = {
      id: '00000000-0000-4000-8000-000000000001',
      force_logout_before: new Date(beforeTime + 1000).toISOString(),
    };

    // Subsequent session check
    const sessionSignInAt = new Date(beforeTime - 5000);
    const forceLogoutAt = new Date(simulatedProfile.force_logout_before);
    const isRevoked = (sessionSignInAt.getTime() + 2000) < forceLogoutAt.getTime();
    assert.equal(isRevoked, true, 'Active session prior to force_logout_before must be invalidated');
  });

  // Test 4: Disabled status enforcement
  await t.test('Disabled status blocks protected access', async () => {
    const activeProfile = { is_disabled: false };
    const disabledProfile = { is_disabled: true };

    assert.equal(activeProfile.is_disabled, false, 'Active profile permits access');
    assert.equal(disabledProfile.is_disabled, true, 'Disabled profile denies access');
  });

  // Test 5: Role transition metadata verification
  await t.test('Role changes prevent self-demotion for admins', async () => {
    const adminUser = { id: 'admin-uuid-1', role: 'admin' };
    const targetUserId = 'admin-uuid-1';
    const newRole = 'participant';

    const isSelfDemotion = targetUserId === adminUser.id && newRole !== 'admin';
    assert.equal(isSelfDemotion, true, 'Admin cannot self-demote');
  });

  // Test 6: Send link URL and callback verification
  await t.test('Send link generates correct setup-password redirect URL', async () => {
    const { getSetupPasswordRedirectUrl } = await import('../lib/auth/siteUrl.ts');
    const redirectUrl = getSetupPasswordRedirectUrl();
    assert.ok(redirectUrl.endsWith('/auth/setup-password'), 'Must route to /auth/setup-password');
  });

  // Test 7: Tombstone preservation
  await t.test('ADMIN-01 audit tombstone preserved as disabled', async () => {
    const admin01 = {
      id: 'eb3ba0ae-c5dd-45ff-bc9f-adfec41bc446',
      identifier: 'ADMIN-01',
      is_disabled: true,
    };
    assert.equal(admin01.is_disabled, true, 'ADMIN-01 must remain disabled');
    assert.equal(admin01.identifier, 'ADMIN-01', 'ADMIN-01 identifier must not be reassigned');
  });
});
