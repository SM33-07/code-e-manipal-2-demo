import { query } from '@/lib/db';
import type { Profile, UpdateProfileInput, UserRole } from '@/types';

/**
 * Fetch a single user profile by ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { rows } = await query('SELECT * FROM public.profiles WHERE id = $1 LIMIT 1', [userId]);
  return (rows[0] as Profile) || null;
}

/**
 * Update user profile details
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<Profile> {
  const keys = Object.keys(input);
  if (keys.length === 0) {
    const current = await getProfile(userId);
    if (!current) throw new Error('Profile not found');
    return current;
  }

  const setClause = keys.map((key, index) => `"${key}" = $${index + 2}`).join(', ');
  const values = keys.map((key) => (input as any)[key]);

  const { rows } = await query(
    `UPDATE public.profiles SET ${setClause} WHERE id = $1 RETURNING *`,
    [userId, ...values]
  );
  const updated = rows[0];
  if (!updated) throw new Error('Profile not found for update');

  return updated as Profile;
}

/**
 * Fetch all profiles, optionally filtering by role
 */
export async function getAllProfiles(role?: string): Promise<Profile[]> {
  let sql = 'SELECT * FROM public.profiles';
  const params: any[] = [];

  if (role) {
    sql += ' WHERE role = $1';
    params.push(role);
  }

  sql += ' ORDER BY name ASC';

  const { rows } = await query(sql, params);
  return rows as Profile[];
}

/**
 * Promote or demote a user's role (Admin action)
 */
export async function setUserRole(
  userId: string,
  role: UserRole
): Promise<Profile> {
  const { rows } = await query(
    'UPDATE public.profiles SET role = $2 WHERE id = $1 RETURNING *',
    [userId, role]
  );
  const updated = rows[0];
  if (!updated) throw new Error('Profile not found for role update');

  // Sync auth.users raw_user_meta_data so Supabase Auth user_metadata stays in sync
  try {
    await query(
      `UPDATE auth.users
       SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', $2::jsonb)
       WHERE id = $1`,
      [userId, JSON.stringify(role)]
    );
  } catch (e) {
    // Continue even if auth.users is managed strictly by Supabase API
  }

  return updated as Profile;
}
