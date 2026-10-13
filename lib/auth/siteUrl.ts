/**
 * Canonical Site URL & Redirect Helpers
 *
 * Enforces canonical production domain https://code-e-manipal-portal.vercel.app
 * while supporting verified local development environments.
 */

export function getCanonicalSiteUrl(): string {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://code-e-manipal-portal.vercel.app'
  ).trim();

  // Strip all trailing slashes
  return configured.replace(/\/+$/, '');
}

export function getSetupPasswordRedirectUrl(): string {
  return `${getCanonicalSiteUrl()}/auth/setup-password`;
}
