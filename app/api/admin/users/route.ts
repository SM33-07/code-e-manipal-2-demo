import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import { getAllProfiles, setUserRole } from '@/services/profileService';
import { isValidUUID } from '@/lib/utils/validate';
import type { UserRole } from '@/types';
import { logger } from '@/lib/utils/logger';
import { query } from '@/lib/db';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { bulkDeactivateEventAccounts } from '@/lib/admin/credentials';

const VALID_ROLES: UserRole[] = ['participant', 'judge', 'admin'];

/**
 * GET /api/admin/users
 * Admin only — list all user profiles, optionally filtered by role, search, or audit query.
 *
 * Query params:
 *   role — participant | judge | admin
 *   search — text filter for name/email
 *   audit — boolean flag to fetch recent user management audit logs
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') ?? undefined;
    const search = searchParams.get('search')?.trim().toLowerCase();
    const isAuditQuery = searchParams.get('audit') === 'true';

    // Audit logs viewer
    if (isAuditQuery) {
      const { rows: logs } = await query(
        `SELECT al.*, p.name AS actor_name, p.email AS actor_email
         FROM public.audit_logs al
         LEFT JOIN public.profiles p ON p.id = al.user_id
         WHERE al.action IN ('USER_PASSWORD_RESET', 'USER_FORCE_LOGOUT', 'BULK_CREDENTIALS_GENERATED', 'BULK_ACCOUNTS_DEACTIVATED', 'USER_ROLE_CHANGED', 'USER_STATUS_TOGGLED')
         ORDER BY al.created_at DESC
         LIMIT 50`
      );
      return successResponse(logs);
    }

    if (role && !VALID_ROLES.includes(role as UserRole)) {
      return Errors.BAD_REQUEST(`role must be one of: ${VALID_ROLES.join(', ')}`);
    }

    let profiles = await getAllProfiles(role);

    if (search) {
      profiles = profiles.filter(
        (p) =>
          p.name?.toLowerCase().includes(search) ||
          p.email?.toLowerCase().includes(search) ||
          p.identifier?.toLowerCase().includes(search)
      );
    }

    logger.info('GET /api/admin/users', { role: role ?? 'all', count: profiles.length });

    return successResponse(profiles, { total: profiles.length });
  } catch (err) {
    logger.error('GET /api/admin/users', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'admin');

/**
 * POST /api/admin/users
 * Admin only — user account actions:
 * - action === 'create': direct individual account creation
 * - action === 'toggle-disable': account disable/enable toggle
 * - action === 'bulk-deactivate': bulk disable participant & judge accounts on event end
 * - default: promote or demote a user's role
 */
export const POST = withAuth(async (req, { user: adminUser }) => {
  try {
    const body = await req.json();
    const { action, user_id, role, email, password, name, is_disabled } = body;

    // ── Bulk Deactivation on Event Conclusion ─────────────────
    if (action === 'bulk-deactivate') {
      const count = await bulkDeactivateEventAccounts(adminUser.id);
      return successResponse({
        message: `Successfully deactivated ${count} event accounts.`,
        deactivated_count: count,
      });
    }

    // ── Account Enable / Disable Toggle ───────────────────────
    if (action === 'toggle-disable') {
      if (!user_id || !isValidUUID(user_id)) {
        return Errors.BAD_REQUEST('A valid user_id is required');
      }

      if (user_id === adminUser.id) {
        return Errors.BAD_REQUEST('Admins cannot disable their own account');
      }

      const { rows: current } = await query(
        'SELECT id, email, role, is_disabled FROM public.profiles WHERE id = $1 LIMIT 1',
        [user_id]
      );

      if (current.length === 0) return Errors.NOT_FOUND('User profile');

      const targetUser = current[0];
      const newStatus = is_disabled !== undefined ? Boolean(is_disabled) : !targetUser.is_disabled;

      // Update is_disabled and force logout if disabled
      const { rows: updated } = await query(
        `UPDATE public.profiles
         SET is_disabled = $1,
             force_logout_before = CASE WHEN $1 = true THEN NOW() ELSE force_logout_before END,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [newStatus, user_id]
      );

      // Record audit log
      await query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUser.id,
          'USER_STATUS_TOGGLED',
          'profiles',
          user_id,
          JSON.stringify({
            target_email: targetUser.email,
            previous_status: targetUser.is_disabled ? 'disabled' : 'active',
            new_status: newStatus ? 'disabled' : 'active',
          }),
        ]
      );

      return successResponse(updated[0], {
        message: `User account has been ${newStatus ? 'disabled' : 'enabled'}.`,
      });
    }

    // ── Create User Account ────────────────────────────────────
    if (action === 'create') {
      if (!email?.trim()) return Errors.BAD_REQUEST('Email is required');
      if (!password || password.length < 6) {
        return Errors.BAD_REQUEST('Password must be at least 6 characters');
      }
      if (!name?.trim()) return Errors.BAD_REQUEST('Name is required');
      if (!role || !VALID_ROLES.includes(role as UserRole)) {
        return Errors.BAD_REQUEST(`role must be one of: ${VALID_ROLES.join(', ')}`);
      }

      const emailLower = email.trim().toLowerCase();
      const nameClean = name.trim();

      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
        return Errors.BAD_REQUEST('Invalid email format');
      }

      // Check if email already exists in profiles
      const emailCheck = await query(
        'SELECT id FROM public.profiles WHERE LOWER(email) = $1',
        [emailLower]
      );
      if (emailCheck.rows.length > 0) {
        return Errors.CONFLICT('A user with this email already exists');
      }

      const supabase = createSupabaseAdminClient();

      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: emailLower,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: nameClean,
          role: role,
        },
      });

      if (authError) {
        logger.error('POST /api/admin/users (creation) — auth user creation failed', {
          error: authError.message,
          email: emailLower,
        });
        if (authError.message.includes('already') || authError.message.includes('exists')) {
          return Errors.CONFLICT('A user with this email already exists in authentication');
        }
        return Errors.INTERNAL('Failed to create authentication user');
      }

      if (authData.user) {
        try {
          await query(
            'INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
            [authData.user.id, emailLower, JSON.stringify({ name: nameClean, role: role })]
          );
        } catch (e) {
          logger.warn('auth.users sync note', { error: String(e) });
        }

        const { rows: profileRows } = await query(
          `INSERT INTO public.profiles (id, name, email, avatar_url, role)
           VALUES ($1, $2, $3, '', $4)
           ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name
           RETURNING *`,
          [authData.user.id, nameClean, emailLower, role]
        );

        logger.info('POST /api/admin/users (direct create)', {
          targetUserId: authData.user.id,
          role,
          createdBy: adminUser.id,
        });

        return successResponse(
          profileRows[0] ?? { id: authData.user.id, name: nameClean, email: emailLower, role },
          { message: 'User account created successfully' },
          201
        );
      }

      return Errors.INTERNAL('User creation failed');
    }

    // ── Update Existing Role ───────────────────────────────────
    if (!user_id || !isValidUUID(user_id)) {
      return Errors.BAD_REQUEST('A valid user_id is required');
    }

    if (!role || !VALID_ROLES.includes(role as UserRole)) {
      return Errors.BAD_REQUEST(`role must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // Prevent an admin from demoting themselves
    if (user_id === adminUser.id && role !== 'admin') {
      return Errors.BAD_REQUEST('Admins cannot remove their own admin role');
    }

    // Update the authoritative Azure profile first.
    const updated = await setUserRole(user_id, role as UserRole);

    await query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminUser.id,
        'USER_ROLE_CHANGED',
        'profiles',
        user_id,
        JSON.stringify({ new_role: role }),
      ]
    );

    const supabase = createSupabaseAdminClient();
    const { error: metadataUpdateError } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: { role },
    });
    if (metadataUpdateError) {
      logger.error('Supabase Auth role mirror update failed after Azure profile role change', {
        targetUserId: user_id,
        role,
        error: metadataUpdateError.message,
      });
      return Errors.INTERNAL(
        'Azure profile role was updated, but the Supabase Auth role mirror could not be synchronized. Verify both role sources before considering the repair complete.'
      );
    }

    const { data: verifiedAuthUser, error: metadataReadError } =
      await supabase.auth.admin.getUserById(user_id);
    const verifiedMetadataRole = verifiedAuthUser?.user?.user_metadata?.role;
    if (metadataReadError || verifiedMetadataRole !== role || updated.role !== role) {
      logger.error('Role repair verification failed', {
        targetUserId: user_id,
        azureProfileRole: updated.role,
        expectedRole: role,
        authMetadataRole: verifiedMetadataRole ?? null,
        error: metadataReadError?.message,
      });
      return Errors.INTERNAL(
        'Role repair verification failed. Azure profile and Supabase Auth role metadata must match before considering the repair complete.'
      );
    }

    logger.info('POST /api/admin/users (role update)', {
      targetUserId: user_id,
      newRole: role,
      changedBy: adminUser.id,
    });

    return successResponse(updated, {
      roleVerification: {
        azureProfileRole: updated.role,
        authMetadataRole: verifiedMetadataRole,
        verified: true,
      },
    });
  } catch (err) {
    logger.error('POST /api/admin/users', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'admin');
