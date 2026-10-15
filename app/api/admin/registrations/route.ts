import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSetupPasswordRedirectUrl } from '@/lib/auth/siteUrl';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';
import { decrypt } from '@/lib/utils/crypto';

/**
 * GET /api/admin/registrations
 * Admin only — list hackathon registrations.
 *
 * Query params:
 *   status — pending | approved | rejected (optional)
 *   round  — 1 | 2 (optional)
 */
export const GET = withAuth(async (req) => {
  try {
    const status = req.nextUrl.searchParams.get('status');
    const round = req.nextUrl.searchParams.get('round');

    let sql = 'SELECT * FROM public.hackathon_registrations WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      sql += ` AND status = $${paramIdx++}`;
      params.push(status);
    }

    if (round && ['1', '2'].includes(round)) {
      sql += ` AND round = $${paramIdx++}`;
      params.push(parseInt(round, 10));
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);

    // Get counts per status
    const countResult = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
      FROM public.hackathon_registrations
    `);

    const counts = countResult.rows[0] || { total: 0, pending: 0, approved: 0, rejected: 0 };

    logger.info('GET /api/admin/registrations', {
      status: status ?? 'all',
      round: round ?? 'all',
      count: result.rows.length,
    });

    return successResponse(result.rows, { counts });
  } catch (err) {
    logger.error('GET /api/admin/registrations', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'admin');

/**
 * PATCH /api/admin/registrations
 * Admin only — approve or reject a registration.
 *
 * Body: { id: string, action: 'approve' | 'reject' }
 * Or bulk: { ids: string[], action: 'approve' | 'reject' }
 */
export const PATCH = withAuth(async (req, { user: adminUser }) => {
  try {
    const body = await req.json();
    const { action } = body;
    const ids: string[] = body.ids || (body.id ? [body.id] : []);

    if (!['approve', 'reject'].includes(action)) {
      return Errors.BAD_REQUEST('action must be "approve" or "reject"');
    }

    if (ids.length === 0) {
      return Errors.BAD_REQUEST('id or ids is required');
    }

    const results: { id: string; status: string; error?: string }[] = [];

    for (const regId of ids) {
      // Fetch registration
      const regResult = await query(
        'SELECT * FROM public.hackathon_registrations WHERE id = $1',
        [regId]
      );

      if (regResult.rows.length === 0) {
        results.push({ id: regId, status: 'error', error: 'Registration not found' });
        continue;
      }

      const reg = regResult.rows[0];

      if (reg.status !== 'pending') {
        results.push({ id: regId, status: 'error', error: `Already ${reg.status}` });
        continue;
      }

      if (action === 'approve') {
        let passwordToUse = crypto.randomUUID().replace(/-/g, '').slice(0, 24) + 'A1!';
        let hasCustomPassword = false;

        if (reg.encrypted_password) {
          try {
            passwordToUse = decrypt(reg.encrypted_password);
            hasCustomPassword = true;
          } catch (e) {
            logger.warn('Failed to decrypt password, falling back to random password', { error: String(e) });
          }
        }

        // Create Supabase Auth user
        const supabase = createSupabaseAdminClient();

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: reg.email,
          password: passwordToUse,
          email_confirm: true,
          user_metadata: {
            name: reg.name,
            role: 'participant',
          },
        });

        if (authError) {
          logger.error('PATCH /api/admin/registrations — auth create failed', {
            regId,
            error: authError.message,
          });
          results.push({ id: regId, status: 'error', error: authError.message });
          continue;
        }

        // Sync to Azure auth.users + create profile
        if (authData.user) {
          try {
            await query(
              'INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
              [authData.user.id, reg.email, JSON.stringify({ name: reg.name, role: 'participant' })]
            );
          } catch (e) {
            logger.warn('auth.users sync note', { error: String(e) });
          }

          await query(
            `INSERT INTO public.profiles (id, name, email, avatar_url, role)
             VALUES ($1, $2, $3, '', 'participant')
             ON CONFLICT (id) DO NOTHING`,
            [authData.user.id, reg.name, reg.email]
          );
        }

        // Send invite email (user clicks link → logs in / sets password)
        const setupRedirect = getSetupPasswordRedirectUrl();
        try {
          await supabase.auth.admin.inviteUserByEmail(reg.email, {
            redirectTo: setupRedirect,
          });
        } catch (e) {
          // Invite might fail if user already confirmed, that's ok
          logger.warn('Invite email note', { error: String(e) });

          // Fallback: send recovery link
          try {
            await supabase.auth.admin.generateLink({
              type: 'recovery',
              email: reg.email,
              options: { redirectTo: setupRedirect },
            });
          } catch (e2) {
            logger.warn('Recovery link fallback note', { error: String(e2) });
          }
        }

        // Update registration status
        await query(
          `UPDATE public.hackathon_registrations
           SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
           WHERE id = $2`,
          [adminUser.id, regId]
        );

        logger.info('Registration approved', { regId, email: reg.email, approvedBy: adminUser.id });
        results.push({ id: regId, status: 'approved' });
      } else {
        // Reject
        await query(
          `UPDATE public.hackathon_registrations
           SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
           WHERE id = $2`,
          [adminUser.id, regId]
        );

        logger.info('Registration rejected', { regId, email: reg.email, rejectedBy: adminUser.id });
        results.push({ id: regId, status: 'rejected' });
      }
    }

    return successResponse(results);
  } catch (err) {
    logger.error('PATCH /api/admin/registrations', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'admin');
