import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { isDemoMode } from '@/lib/demo/demoMode';

/**
 * GET /api/auth/callback
 *
 * Handles the OAuth / magic-link code exchange.
 * Supabase redirects here after the user authenticates externally.
 * Sets the session cookie and redirects to the intended page.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;

  if (isDemoMode()) {
    return NextResponse.redirect(`${origin}/login?notice=demo_mode`);
  }
  const code  = searchParams.get('code');
  const type  = searchParams.get('type');
  const error = searchParams.get('error');

  const isSetupOrRecovery = type === 'recovery' || type === 'invite' || !type || searchParams.get('next')?.includes('setup-password');

  // Supabase may return an error param on failure
  if (error) {
    logger.warn('Auth callback returned error from provider', { error, type });
    if (isSetupOrRecovery) {
      return NextResponse.redirect(
        `${origin}/auth/setup-password?error=${encodeURIComponent(error)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    logger.warn('Auth callback called without a code param', { type });
    if (isSetupOrRecovery) {
      return NextResponse.redirect(`${origin}/auth/setup-password?error=missing_code`);
    }
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      logger.error('Code exchange failed', { error: exchangeError.message, type });
      if (isSetupOrRecovery) {
        return NextResponse.redirect(
          `${origin}/auth/setup-password?error=${encodeURIComponent(exchangeError.message)}`
        );
      }
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    // Redirect to the originally-intended path (defaults to /auth/setup-password for recovery/invite/untyped email flows, / otherwise)
    const defaultNext = isSetupOrRecovery ? '/auth/setup-password' : '/';
    const next = searchParams.get('next') ?? defaultNext;
    const redirectTo = next.startsWith('/') ? `${origin}${next}` : origin;
    logger.info('Auth callback successful', { next: redirectTo, type });
    return NextResponse.redirect(redirectTo);

  } catch (err) {
    logger.error('Auth callback unexpected error', { error: String(err), type });
    if (isSetupOrRecovery) {
      return NextResponse.redirect(`${origin}/auth/setup-password?error=server_error`);
    }
    return NextResponse.redirect(`${origin}/login?error=server_error`);
  }
}
