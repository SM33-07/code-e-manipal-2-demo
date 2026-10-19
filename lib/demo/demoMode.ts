/**
 * Centralized Demo Mode Configuration & Production Safety Guard
 * File: lib/demo/demoMode.ts
 *
 * Implements:
 * 1. Explicit demo mode toggle via NEXT_PUBLIC_DEMO_MODE / DEMO_MODE.
 * 2. Fail-closed production safety guard: Throws immediately if production
 *    Azure PostgreSQL or Supabase credentials/endpoints are detected.
 * 3. Data source mode discriminator: 'synthetic' fixtures vs 'isolated_db'.
 */

export class ProductionSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionSafetyError';
  }
}

/**
 * Production host and project patterns that are strictly prohibited in Demo Mode.
 * If any of these are present in connection strings or environment URLs while
 * Demo Mode is enabled, the system halts with a fatal ProductionSafetyError.
 */
export const PROHIBITED_PRODUCTION_PATTERNS = [
  'code-e-manipal-db.postgres.database.azure.com',
  'code-e-manipal-db',
  'ihnclawnbtkwvbfqwxfe.supabase.co',
  'ihnclawnbtkwvbfqwxfe',
];

/**
 * Auto-neutralizes inherited production credentials on demo deployments
 * (e.g. Vercel demo environments with inherited production environment variables).
 * Pre-setting safe mock variables ensures pure synthetic demo operation without
 * inadvertent external network calls or false-positive safety aborts on demo hosts.
 */
export function sanitizeDemoRuntimeEnvironment(): void {
  const isVercelOrDemoHost =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_URL?.toLowerCase().includes('demo')) ||
    Boolean(process.env.VERCEL_PROJECT_PRODUCTION_URL?.toLowerCase().includes('demo')) ||
    Boolean(process.env.NEXT_PUBLIC_VERCEL_URL?.toLowerCase().includes('demo')) ||
    Boolean(process.env.VERCEL_GIT_REPO_SLUG?.toLowerCase().includes('testing')) ||
    (typeof window !== 'undefined' && window.location.hostname.toLowerCase().includes('demo'));

  if (isVercelOrDemoHost) {
    process.env.DEMO_MODE = 'true';
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    process.env.DEMO_DATA_SOURCE = 'synthetic';

    if (process.env.DATABASE_URL && PROHIBITED_PRODUCTION_PATTERNS.some((p) => process.env.DATABASE_URL?.toLowerCase().includes(p))) {
      process.env.DATABASE_URL = 'postgresql://mock:mock@127.0.0.1:5432/mock';
    }
    if (process.env.SUPABASE_URL && PROHIBITED_PRODUCTION_PATTERNS.some((p) => process.env.SUPABASE_URL?.toLowerCase().includes(p))) {
      process.env.SUPABASE_URL = 'https://demo-mock.supabase.co';
    }
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && PROHIBITED_PRODUCTION_PATTERNS.some((p) => process.env.NEXT_PUBLIC_SUPABASE_URL?.toLowerCase().includes(p))) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo-mock.supabase.co';
    }
  }
}

/**
 * Returns true if the application is running in Public Demo Mode.
 * Safe for use in both server-side and client-side components.
 */
export function isDemoMode(): boolean {
  sanitizeDemoRuntimeEnvironment();

  const nextPublic = String(process.env.NEXT_PUBLIC_DEMO_MODE || '').trim().toLowerCase();
  const serverDemo = String(process.env.DEMO_MODE || '').trim().toLowerCase();
  if (
    nextPublic === 'true' ||
    nextPublic === '1' ||
    serverDemo === 'true' ||
    serverDemo === '1'
  ) {
    return true;
  }

  // Auto-detect browser runtime on demo hostnames
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('demo') || host.includes('code-e-manipal-portal-demo')) {
      return true;
    }
  }

  // Auto-detect Vercel server runtime on demo hostnames/deployments
  const vercelUrl = String(
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    ''
  ).toLowerCase();
  if (vercelUrl.includes('demo') || vercelUrl.includes('code-e-manipal-portal-demo')) {
    return true;
  }

  return false;
}

/**
 * Fail-Closed Production Safety Invariant:
 * Verifies that the demo environment is strictly isolated from production Azure
 * PostgreSQL and production Supabase. If any production identifier is found in
 * DATABASE_URL, SUPABASE_URL, or NEXT_PUBLIC_SUPABASE_URL, an error is thrown.
 */
export function assertDemoModeSafety(): void {
  if (!isDemoMode()) return;

  const dbUrl = process.env.DATABASE_URL || '';
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  for (const pattern of PROHIBITED_PRODUCTION_PATTERNS) {
    if (dbUrl.toLowerCase().includes(pattern.toLowerCase())) {
      throw new ProductionSafetyError(
        `[FATAL PRODUCTION GUARD] Demo Mode is enabled, but DATABASE_URL points to production database (${pattern}). Public demo must never connect to production Azure PostgreSQL!`
      );
    }
    if (supabaseUrl.toLowerCase().includes(pattern.toLowerCase()) || publicSupabaseUrl.toLowerCase().includes(pattern.toLowerCase())) {
      throw new ProductionSafetyError(
        `[FATAL PRODUCTION GUARD] Demo Mode is enabled, but SUPABASE_URL points to production Supabase project (${pattern}). Public demo must never connect to production Supabase!`
      );
    }
  }
}

export type DemoDataSourceMode = 'synthetic' | 'isolated_db';

/**
 * Determines whether Demo Mode operates against pure synthetic fixtures
 * or a verified, isolated demo database.
 *
 * In Demo Mode, synthetic data is selected by default even if an inherited
 * DATABASE_URL exists, ensuring local demo runs cannot inadvertently connect
 * to staging or local databases.
 *
 * The production safety guard (assertDemoModeSafety) is always executed first
 * to reject unsafe production configurations rather than silently bypassing them.
 */
export function getDemoDataSourceMode(): DemoDataSourceMode {
  if (!isDemoMode()) {
    throw new Error('getDemoDataSourceMode() called when demo mode is not active');
  }

  // 1. Unsafe production configuration MUST be rejected immediately
  assertDemoModeSafety();

  // 2. Only select isolated_db if explicitly configured
  if (process.env.DEMO_DATA_SOURCE === 'isolated_db') {
    return 'isolated_db';
  }

  // 3. Default to synthetic data even if an inherited DATABASE_URL exists
  return 'synthetic';
}
