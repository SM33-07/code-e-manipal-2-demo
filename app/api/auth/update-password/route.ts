import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Errors, successResponse } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/auth/update-password
 *
 * Secure server-side password update endpoint.
 * Ensures client-side code never needs Supabase service/anon keys to update credentials.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let user = null;
    if (bearerToken) {
      const { data } = await supabase.auth.getUser(bearerToken);
      user = data.user;
    } else {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user || !user.email) {
      return Errors.UNAUTHORIZED('Authentication required to update password.');
    }

    const body = await req.json().catch(() => ({}));
    const newPassword = body.password;

    if (!newPassword || typeof newPassword !== 'string') {
      return Errors.BAD_REQUEST('Password is required.');
    }

    const { data, error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      logger.warn('Failed to update password via GoTrue', { userId: user.id, error: updateError.message });
      return Errors.BAD_REQUEST(updateError.message);
    }

    logger.info('Password successfully updated', { userId: user.id });
    return successResponse({ user: data.user });
  } catch (err: any) {
    logger.error('POST /api/auth/update-password unexpected error', { error: String(err) });
    return Errors.INTERNAL('Failed to update password.');
  }
}
