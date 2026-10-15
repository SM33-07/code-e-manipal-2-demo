import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateCsrf } from '@/lib/auth/csrf';
import { checkEndpointRateLimit, serverSleep } from '@/lib/auth/throttle';
import { extractClientIp, hashClientIp } from '@/lib/auth/telemetry';
import { getSetupPasswordRedirectUrl } from '@/lib/auth/siteUrl';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { Errors, successResponse } from '@/lib/utils/response';

/** Generic public message for enumeration resistance */
const GENERIC_SUCCESS_MESSAGE =
  "If an account exists for that email address, you'll receive instructions to reset your password. Check your inbox and spam folder.";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    // 1. CSRF validation
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    // 2. Coarse IP rate limiting (campus NAT safe)
    const clientIp = extractClientIp(req.headers);
    const ipHash = hashClientIp(clientIp);
    if (!checkEndpointRateLimit(ipHash)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    // 3. Parse and validate input
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid request payload.');
    }

    const email = (body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      return Errors.BAD_REQUEST('Please enter a valid email address.');
    }

    // 4. Verify required server configuration
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('POST /api/auth/forgot-password: missing required Supabase server configuration');
      return NextResponse.json(
        { error: 'Authentication service temporarily misconfigured. Please contact support.' },
        { status: 500 }
      );
    }

    // 5. Verify account existence in authoritative profiles
    const { rows } = await query(
      'SELECT id, role, identifier, is_disabled FROM public.profiles WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    const profile = rows[0];

    // If profile exists and is active, issue Supabase recovery
    if (profile && !profile.is_disabled) {
      const redirectTo = getSetupPasswordRedirectUrl();
      const supabaseAdmin = createSupabaseAdminClient();

      try {
        const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo,
        });

        if (resetErr) {
          logger.warn('Password recovery provider note', {
            emailHash: hashClientIp(email),
            error: resetErr.message,
            status: (resetErr as any).status,
          });

          // Check if provider returned rate-limiting response (GoTrue 429)
          const isRateLimit =
            (resetErr as any).status === 429 ||
            /rate limit|too many|once every/i.test(resetErr.message);

          if (isRateLimit) {
            return NextResponse.json(
              {
                error: 'Email delivery rate limit reached. Please wait a few minutes before requesting another reset link.',
              },
              { status: 429 }
            );
          }
        } else {
          // Record truthful audit log
          await query(
            `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
             VALUES ($1, 'USER_PASSWORD_RECOVERY_REQUESTED', 'profiles', $1, $2)`,
            [
              profile.id,
              JSON.stringify({
                role: profile.role,
                identifier: profile.identifier,
                email,
                delivery_channel: 'supabase-mailer',
                redirect_url: redirectTo,
                status: 'PROVIDER_ACCEPTED',
                requested_at: new Date().toISOString(),
              }),
            ]
          );
        }
      } catch (err: any) {
        logger.error('Failed to trigger resetPasswordForEmail', { error: err.message });
      }
    } else {
      // Artificial delay to prevent timing attacks on non-existent accounts
      await serverSleep(150 + Math.floor(Math.random() * 100));
    }

    // Always return enumeration-resistant generic success response
    return successResponse({ message: GENERIC_SUCCESS_MESSAGE });
  } catch (error: any) {
    logger.error('POST /api/auth/forgot-password unexpected error', { error: String(error) });
    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 });
  }
}
