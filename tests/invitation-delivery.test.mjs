import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSiteUrl,
  issuePasswordSetupInvitation,
} from '../scripts/provision-admin-judge.mjs';

describe('Password Setup Invitation: URL Resolution', () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (originalSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    else delete process.env.NEXT_PUBLIC_SITE_URL;

    if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  });

  test('1. Prioritizes NEXT_PUBLIC_SITE_URL over NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://code-e-manipal-portal.vercel.app';
    process.env.NEXT_PUBLIC_APP_URL = 'https://some-other-domain.vercel.app';

    const resolved = resolveSiteUrl({ isProduction: true, sendInvitations: true });
    assert.equal(resolved, 'https://code-e-manipal-portal.vercel.app');
  });

  test('2. Normalizes trailing slashes properly on canonical domain', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://code-e-manipal-portal.vercel.app///';
    const resolved = resolveSiteUrl({ isProduction: true, sendInvitations: true });
    assert.equal(resolved, 'https://code-e-manipal-portal.vercel.app');
  });

  test('3. Rejects localhost in production mode when sending invitations', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
    assert.throws(
      () => resolveSiteUrl({ isProduction: true, sendInvitations: true }),
      /Production Security Violation/
    );
  });

  test('4. Rejects missing URL configuration when invitations requested', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.throws(
      () => resolveSiteUrl({ isProduction: false, sendInvitations: true }),
      /Production URL Configuration Error/
    );
  });
});

describe('Password Setup Invitation: Delivery & Truthful Audit Logging', () => {
  const siteUrl = 'https://code-e-manipal-portal.vercel.app';
  const testUserId = 'f60c8727-29fb-4e19-81ea-8ff48f9758b7';
  const testEmail = 'abhinav.ong@gmail.com';

  test('1. Supabase Auth mailer delivery success records PROVIDER_ACCEPTED truthfully without claiming mailbox delivery', async () => {
    let capturedReset = null;
    const mockSupabase = {
      auth: {
        resetPasswordForEmail: async (email, options) => {
          capturedReset = { email, options };
          return { data: {}, error: null };
        },
      },
    };

    const auditQueries = [];
    const mockPgClient = {
      query: async (sql, params) => {
        auditQueries.push({ sql, params });
        return { rows: [] };
      },
    };

    const result = await issuePasswordSetupInvitation(mockSupabase, mockPgClient, {
      email: testEmail,
      role: 'admin',
      identifier: 'ADMIN-02',
      userId: testUserId,
      siteUrl,
      deliveryChannel: 'supabase-mailer',
    });

    // 1. Verify API invocation
    assert.equal(result.success, true);
    assert.equal(result.status, 'PROVIDER_ACCEPTED');
    assert.equal(result.deliveryConfirmed, false);
    assert.equal(capturedReset.email, testEmail);
    assert.equal(capturedReset.options.redirectTo, 'https://code-e-manipal-portal.vercel.app/auth/setup-password');

    // 2. Verify Audit Log Truthfulness
    assert.equal(auditQueries.length, 1);
    const [audit] = auditQueries;
    assert.ok(audit.sql.includes('public.audit_logs'));
    assert.equal(audit.params[0], testUserId);
    assert.equal(audit.params[1], 'ADMIN_PASSWORD_RECOVERY_REQUESTED');
    assert.equal(audit.params[2], testUserId);

    const details = JSON.parse(audit.params[3]);
    assert.equal(details.role, 'admin');
    assert.equal(details.identifier, 'ADMIN-02');
    assert.equal(details.email, testEmail);
    assert.equal(details.delivery_channel, 'supabase-mailer');
    assert.equal(details.redirect_url, 'https://code-e-manipal-portal.vercel.app/auth/setup-password');
    assert.equal(details.status, 'PROVIDER_ACCEPTED');
    assert.equal(details.delivery_confirmed, false);
    assert.ok(details.note.includes('accepted by Supabase Auth mailer'));
  });

  test('2. Supabase Auth mailer error records PROVIDER_FAILED truthfully', async () => {
    const mockSupabase = {
      auth: {
        resetPasswordForEmail: async () => {
          return { data: null, error: new Error('Rate limit exceeded for email delivery (429)') };
        },
      },
    };

    const auditQueries = [];
    const mockPgClient = {
      query: async (sql, params) => {
        auditQueries.push({ sql, params });
        return { rows: [] };
      },
    };

    const result = await issuePasswordSetupInvitation(mockSupabase, mockPgClient, {
      email: testEmail,
      role: 'admin',
      identifier: 'ADMIN-02',
      userId: testUserId,
      siteUrl,
      deliveryChannel: 'supabase-mailer',
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'PROVIDER_FAILED');
    assert.equal(result.deliveryConfirmed, false);
    assert.ok(result.message.includes('Rate limit exceeded'));

    assert.equal(auditQueries.length, 1);
    const [audit] = auditQueries;
    assert.equal(audit.params[1], 'ADMIN_PASSWORD_RECOVERY_FAILED');

    const details = JSON.parse(audit.params[3]);
    assert.equal(details.status, 'PROVIDER_FAILED');
    assert.equal(details.delivery_confirmed, false);
    assert.ok(details.error.includes('Rate limit exceeded'));
  });

  test('3. Action-link generation without dispatcher records LINK_GENERATED_NO_DELIVERY_HANDLER and never leaks token', async () => {
    let capturedLinkParams = null;
    const mockSupabase = {
      auth: {
        admin: {
          generateLink: async (params) => {
            capturedLinkParams = params;
            return {
              data: {
                properties: {
                  action_link: 'https://test.supabase.co/auth/v1/verify?token=secret123456&type=recovery',
                  email_otp: '123456',
                  hashed_token: 'hash123',
                },
                user: { id: testUserId, email: testEmail },
              },
              error: null,
            };
          },
        },
      },
    };

    const auditQueries = [];
    const mockPgClient = {
      query: async (sql, params) => {
        auditQueries.push({ sql, params });
        return { rows: [] };
      },
    };

    const result = await issuePasswordSetupInvitation(mockSupabase, mockPgClient, {
      email: testEmail,
      role: 'admin',
      identifier: 'ADMIN-02',
      userId: testUserId,
      siteUrl,
      deliveryChannel: 'action-link',
      customLinkDispatcher: null,
    });

    assert.equal(result.status, 'LINK_GENERATED_NO_DELIVERY_HANDLER');
    assert.equal(result.deliveryConfirmed, false);
    assert.equal(capturedLinkParams.type, 'recovery');
    assert.equal(capturedLinkParams.email, testEmail);
    assert.equal(capturedLinkParams.options.redirectTo, 'https://code-e-manipal-portal.vercel.app/auth/setup-password');

    // Verify audit log
    assert.equal(auditQueries.length, 1);
    const [audit] = auditQueries;
    assert.equal(audit.params[1], 'ADMIN_SETUP_LINK_GENERATED');

    const details = JSON.parse(audit.params[3]);
    assert.equal(details.status, 'LINK_GENERATED_NO_DELIVERY_HANDLER');
    assert.equal(details.delivery_confirmed, false);
    // Crucial safety check: zero secret tokens or action links in audit details
    assert.equal(JSON.stringify(details).includes('secret123456'), false);
    assert.equal(JSON.stringify(details).includes('action_link'), false);
    assert.equal(JSON.stringify(details).includes('hash123'), false);
  });

  test('4. Action-link generation with custom dispatcher passes link securely', async () => {
    let dispatchedLink = null;
    const mockCustomDispatcher = async (email, link) => {
      dispatchedLink = { email, link };
      return true;
    };

    const mockSupabase = {
      auth: {
        admin: {
          generateLink: async () => ({
            data: {
              properties: {
                action_link: 'https://test.supabase.co/auth/v1/verify?token=secret_xyz&type=recovery',
              },
              user: { id: testUserId, email: testEmail },
            },
            error: null,
          }),
        },
      },
    };

    const auditQueries = [];
    const mockPgClient = {
      query: async (sql, params) => {
        auditQueries.push({ sql, params });
        return { rows: [] };
      },
    };

    const result = await issuePasswordSetupInvitation(mockSupabase, mockPgClient, {
      email: testEmail,
      role: 'admin',
      identifier: 'ADMIN-02',
      userId: testUserId,
      siteUrl,
      deliveryChannel: 'action-link',
      customLinkDispatcher: mockCustomDispatcher,
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'DISPATCHED_TO_CUSTOM_MAILER');
    assert.equal(result.deliveryConfirmed, false);
    assert.equal(dispatchedLink.email, testEmail);
    assert.equal(dispatchedLink.link, 'https://test.supabase.co/auth/v1/verify?token=secret_xyz&type=recovery');

    // Check audit log
    const [audit] = auditQueries;
    assert.equal(audit.params[1], 'ADMIN_SETUP_LINK_GENERATED');
    const details = JSON.parse(audit.params[3]);
    assert.equal(details.status, 'DISPATCHED_TO_CUSTOM_MAILER');
    // Still zero secrets in audit log
    assert.equal(JSON.stringify(details).includes('secret_xyz'), false);
  });

  test('5. Rejects missing recipient email or site URL before calling any provider', async () => {
    const mockSupabase = { auth: {} };
    const mockPg = { query: async () => ({ rows: [] }) };

    await assert.rejects(
      () => issuePasswordSetupInvitation(mockSupabase, mockPg, { email: '', siteUrl: 'https://code-e-manipal-portal.vercel.app' }),
      /Recipient email is required/
    );

    await assert.rejects(
      () => issuePasswordSetupInvitation(mockSupabase, mockPg, { email: 'admin@test.com', siteUrl: '' }),
      /Site URL is required/
    );
  });

  test('6. Custom dispatcher failure records CUSTOM_DISPATCH_FAILED without token leakage', async () => {
    const failingDispatcher = async () => {
      throw new Error('Upstream mailer API timeout (504 Gateway Timeout)');
    };

    const mockSupabase = {
      auth: {
        admin: {
          generateLink: async () => ({
            data: {
              properties: {
                action_link: 'https://test.supabase.co/auth/v1/verify?token=secret_abc123&type=recovery',
              },
              user: { id: testUserId, email: testEmail },
            },
            error: null,
          }),
        },
      },
    };

    const auditQueries = [];
    const mockPgClient = {
      query: async (sql, params) => {
        auditQueries.push({ sql, params });
        return { rows: [] };
      },
    };

    const result = await issuePasswordSetupInvitation(mockSupabase, mockPgClient, {
      email: testEmail,
      role: 'admin',
      identifier: 'ADMIN-02',
      userId: testUserId,
      siteUrl,
      deliveryChannel: 'action-link',
      customLinkDispatcher: failingDispatcher,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'CUSTOM_DISPATCH_FAILED');
    assert.equal(result.deliveryConfirmed, false);

    assert.equal(auditQueries.length, 1);
    const [audit] = auditQueries;
    const details = JSON.parse(audit.params[3]);
    assert.equal(details.status, 'CUSTOM_DISPATCH_FAILED');
    assert.ok(details.error.includes('Upstream mailer API timeout'));
    assert.equal(JSON.stringify(details).includes('secret_abc123'), false);
  });
});
