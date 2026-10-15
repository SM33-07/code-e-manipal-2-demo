import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Errors, successResponse } from '@/lib/utils/response';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/auth/session
 *
 * Server-side session establishment for recovery, invite, and OAuth flows.
 * Handles tokens (access_token, refresh_token), PKCE codes, and token hashes
 * without requiring Supabase API keys on the client side.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { access_token, refresh_token, code, token_hash, type } = body;
    const supabase = await createSupabaseServerClient();

    let session = null;
    if (access_token && refresh_token) {
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        logger.warn('Failed to set session from tokens', { error: error.message });
        return Errors.BAD_REQUEST(error.message);
      }
      session = data.session;
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        logger.warn('Failed to exchange code for session', { error: error.message });
        return Errors.BAD_REQUEST(error.message);
      }
      session = data.session;
    } else if (token_hash) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: type || 'recovery' });
      if (error) {
        logger.warn('Failed to verify OTP token hash', { error: error.message });
        return Errors.BAD_REQUEST(error.message);
      }
      session = data.session;
    } else {
      return Errors.BAD_REQUEST('No valid authentication token provided.');
    }

    if (!session?.user) {
      return Errors.UNAUTHORIZED('Could not establish session.');
    }

    let role = 'participant';
    try {
      const { rows } = await query('SELECT role FROM public.profiles WHERE id = $1', [session.user.id]);
      if (rows.length > 0 && rows[0].role) {
        role = rows[0].role;
      }
    } catch (_) {}

    const res = successResponse({
      user: {
        id: session.user.id,
        email: session.user.email,
        role,
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    });

    const cookieStore = await cookies();
    cookieStore.getAll().forEach((c) => {
      res.cookies.set(c.name, c.value);
    });

    return res;
  } catch (err: any) {
    logger.error('POST /api/auth/session unexpected error', { error: String(err) });
    return Errors.INTERNAL('Failed to establish session.');
  }
}
