import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import { getAllProfiles } from '@/services/profileService';
import { isValidUUID } from '@/lib/utils/validate';
import type { UserRole } from '@/types';
import { logger } from '@/lib/utils/logger';
import { query } from '@/lib/db';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { bulkDeactivateEventAccounts } from '@/lib/admin/credentials';
import { provisionAccount, transitionAccountRole, updateAccountLoginId, ProvisioningError } from '@/lib/admin/provisioning';

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
         WHERE al.action IN ('USER_PASSWORD_RESET', 'USER_FORCE_LOGOUT', 'BULK_CREDENTIALS_GENERATED', 'BULK_ACCOUNTS_DEACTIVATED', 'USER_ROLE_CHANGED', 'USER_STATUS_TOGGLED', 'USER_TEAM_ASSIGNED', 'USER_TEAM_UNASSIGNED')
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
          p.identifier?.toLowerCase().includes(search) || p.login_id?.toLowerCase().includes(search) || p.team_name?.toLowerCase().includes(search) || p.registration_team_id?.toLowerCase().includes(search) || p.team_id?.toLowerCase().includes(search)
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
 * - action === 'create': legacy-compatible delegate to shared provisioning
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

    // ── Edit Personalized Login ID (Judges / Admins) ──────────
    if (action === 'edit-login-id') {
      const { user_id, new_login_id } = body;
      if (!user_id || !isValidUUID(user_id)) {
        return Errors.BAD_REQUEST('A valid user_id is required');
      }
      if (!new_login_id || typeof new_login_id !== 'string') {
        return Errors.BAD_REQUEST('A valid new_login_id is required');
      }

      try {
        const updated = await updateAccountLoginId(user_id, new_login_id, adminUser.id);
        return successResponse(updated, {
          message: `Login ID for ${updated.name || updated.email} successfully updated to "${updated.login_id}".`,
        });
      } catch (error) {
        if (error instanceof ProvisioningError) {
          if (error.status === 409) return Errors.CONFLICT(error.message);
          if (error.status === 400) return Errors.BAD_REQUEST(error.message);
          if (error.status === 404) return Errors.NOT_FOUND('User profile');
          return Errors.INTERNAL(error.message);
        }
        throw error;
      }
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

    // ── Assign Participant to Team ───────────────────────────
    if (action === 'assign-team') {
      const { team_id, team_role } = body;
      if (!user_id || !isValidUUID(user_id)) {
        return Errors.BAD_REQUEST('A valid user_id is required');
      }
      if (!team_id || !isValidUUID(team_id)) {
        return Errors.BAD_REQUEST('A valid team_id is required');
      }

      // Check target user profile
      const { rows: profileRows } = await query(
        'SELECT id, name, email, role, identifier, team_id, is_disabled FROM public.profiles WHERE id = $1 LIMIT 1',
        [user_id]
      );
      if (profileRows.length === 0) return Errors.NOT_FOUND('User profile');
      const targetUser = profileRows[0];

      if (targetUser.role !== 'participant') {
        return Errors.BAD_REQUEST(`Only participants can be assigned to teams (current role: ${targetUser.role})`);
      }

      // Check target team
      const { rows: teamRows } = await query(
        'SELECT id, name, invite_code FROM public.teams WHERE id = $1 LIMIT 1',
        [team_id]
      );
      if (teamRows.length === 0) return Errors.NOT_FOUND('Target team');
      const targetTeam = teamRows[0];

      // Check capacity (max 6 members)
      const { rows: existingMembers } = await query(
        'SELECT user_id FROM public.team_members WHERE team_id = $1',
        [team_id]
      );
      const isAlreadyInTeam = existingMembers.some((m: any) => m.user_id === user_id);
      if (!isAlreadyInTeam && existingMembers.length >= 6) {
        return Errors.BAD_REQUEST(`Team "${targetTeam.name}" is already at full capacity (6 members maximum)`);
      }

      const assignedRole = team_role === 'leader' ? 'leader' : 'member';

      // Perform assignment: remove existing team memberships for this user, insert new one, update profile
      await query('DELETE FROM public.team_members WHERE user_id = $1', [user_id]);
      await query(
        'INSERT INTO public.team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
        [team_id, user_id, assignedRole]
      );
      const { rows: updatedProfiles } = await query(
        'UPDATE public.profiles SET team_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [team_id, user_id]
      );

      // Record audit log
      await query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUser.id,
          'USER_TEAM_ASSIGNED',
          'profiles',
          user_id,
          JSON.stringify({
            target_email: targetUser.email,
            target_identifier: targetUser.identifier,
            previous_team_id: targetUser.team_id,
            new_team_id: team_id,
            team_name: targetTeam.name,
            team_role: assignedRole,
          }),
        ]
      );

      return successResponse(
        {
          profile: updatedProfiles[0],
          team: targetTeam,
          team_role: assignedRole,
        },
        { message: `Participant ${targetUser.name || targetUser.email} assigned to team "${targetTeam.name}".` }
      );
    }

    // ── Unassign Participant from Team ─────────────────────────
    if (action === 'unassign-team') {
      if (!user_id || !isValidUUID(user_id)) {
        return Errors.BAD_REQUEST('A valid user_id is required');
      }

      const { rows: profileRows } = await query(
        `SELECT p.id, p.name, p.email, p.role, p.identifier, p.team_id, t.name as team_name
         FROM public.profiles p
         LEFT JOIN public.teams t ON p.team_id = t.id
         WHERE p.id = $1 LIMIT 1`,
        [user_id]
      );
      if (profileRows.length === 0) return Errors.NOT_FOUND('User profile');
      const targetUser = profileRows[0];

      if (!targetUser.team_id) {
        return Errors.BAD_REQUEST('Participant is not currently assigned to any team');
      }

      // Remove from team_members and clear profile team_id
      await query('DELETE FROM public.team_members WHERE user_id = $1', [user_id]);
      const { rows: updatedProfiles } = await query(
        'UPDATE public.profiles SET team_id = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
        [user_id]
      );

      // Record audit log
      await query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUser.id,
          'USER_TEAM_UNASSIGNED',
          'profiles',
          user_id,
          JSON.stringify({
            target_email: targetUser.email,
            target_identifier: targetUser.identifier,
            removed_team_id: targetUser.team_id,
            removed_team_name: targetUser.team_name,
          }),
        ]
      );

      return successResponse(
        { profile: updatedProfiles[0] },
        { message: `Participant ${targetUser.name || targetUser.email} unassigned from team.` }
      );
    }

    // ── Create User Account ────────────────────────────────────
    if (action === 'create') {
      if (!email?.trim()) return Errors.BAD_REQUEST('Email is required');
      if (!password || password.length < 6) return Errors.BAD_REQUEST('Password must be at least 6 characters');
      if (!name?.trim()) return Errors.BAD_REQUEST('Name is required');
      if (!role || !VALID_ROLES.includes(role as UserRole)) {
        return Errors.BAD_REQUEST(`role must be one of: ${VALID_ROLES.join(', ')}`);
      }
      try {
        const account = await provisionAccount(
          {
            name: typeof name === 'string' ? name : '',
            role: role as UserRole,
            email: typeof email === 'string' ? email : undefined,
            password: typeof password === 'string' ? password : undefined,
          },
          adminUser.id
        );

        return successResponse(
          {
            id: account.id,
            name: account.name,
            email: account.email,
            role: account.role,
            identifier: account.identifier,
            login_id: account.login_id,
          },
          { message: 'User account created successfully' },
          201
        );
      } catch (error) {
        if (error instanceof ProvisioningError) {
          if (error.status === 409) return Errors.CONFLICT(error.message);
          if (error.status === 400) return Errors.BAD_REQUEST(error.message);
          if (error.status === 404) return Errors.NOT_FOUND('User profile');
          return Errors.INTERNAL(error.message);
        }
        throw error;
      }
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

    // Update role, canonical identifier, login_id, Auth mirror, and audit
    // trail together inside the shared Azure transaction.
    let updated;
    try {
      updated = await transitionAccountRole(user_id, role as UserRole, adminUser.id);
    } catch (error) {
      if (error instanceof ProvisioningError) {
        if (error.status === 409) return Errors.CONFLICT(error.message);
        if (error.status === 404) return Errors.NOT_FOUND('User profile');
        if (error.status === 400) return Errors.BAD_REQUEST(error.message);
        return Errors.INTERNAL(error.message);
      }
      throw error;
    }

    const supabase = createSupabaseAdminClient();
    const { data: verifiedAuthUser, error: metadataReadError } =
      await supabase.auth.admin.getUserById(user_id);
    const verifiedMetadataRole = verifiedAuthUser?.user?.user_metadata?.role;
    const verifiedMetadataLoginId = verifiedAuthUser?.user?.user_metadata?.login_id ?? null;
    const metadataLoginIdMatches = updated.login_id
      ? verifiedMetadataLoginId === updated.login_id
      : !Object.prototype.hasOwnProperty.call(verifiedAuthUser?.user?.user_metadata || {}, 'login_id');
    if (metadataReadError || verifiedMetadataRole !== role || !metadataLoginIdMatches || updated.role !== role) {
      logger.error('Role repair verification failed', {
        targetUserId: user_id,
        azureProfileRole: updated.role,
        expectedRole: role,
        authMetadataRole: verifiedMetadataRole ?? null,
        authMetadataLoginId: verifiedMetadataLoginId,
        azureIdentifier: updated.identifier,
        azureLoginId: updated.login_id ?? null,
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
          authMetadataLoginId: verifiedMetadataLoginId,
          azureIdentifier: updated.identifier,
          azureLoginId: updated.login_id,
          verified: true,
        },
    });
  } catch (err) {
    logger.error('POST /api/admin/users', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'admin');
